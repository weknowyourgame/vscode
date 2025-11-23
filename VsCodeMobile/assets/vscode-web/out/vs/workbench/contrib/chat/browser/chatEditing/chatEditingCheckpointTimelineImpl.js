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
import { equals as arraysEqual } from '../../../../../base/common/arrays.js';
import { findFirst, findLast, findLastIdx } from '../../../../../base/common/arraysFind.js';
import { assertNever } from '../../../../../base/common/assert.js';
import { ThrottledDelayer } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ResourceSet } from '../../../../../base/common/map.js';
import { equals as objectsEqual } from '../../../../../base/common/objects.js';
import { derived, derivedOpts, ObservablePromise, observableSignalFromEvent, observableValue, observableValueOpts, transaction } from '../../../../../base/common/observable.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { TextModel } from '../../../../../editor/common/model/textModel.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { CellUri } from '../../../notebook/common/notebookCommon.js';
import { INotebookEditorModelResolverService } from '../../../notebook/common/notebookEditorModelResolverService.js';
import { INotebookService } from '../../../notebook/common/notebookService.js';
import { FileOperationType } from './chatEditingOperations.js';
import { ChatEditingSnapshotTextModelContentProvider } from './chatEditingTextModelContentProviders.js';
import { createSnapshot as createNotebookSnapshot, restoreSnapshot as restoreNotebookSnapshot } from './notebook/chatEditingModifiedNotebookSnapshot.js';
const START_REQUEST_EPOCH = '$$start';
const STOP_ID_EPOCH_PREFIX = '__epoch_';
/**
 * Implementation of the checkpoint-based timeline system.
 *
 * Invariants:
 * - There is at most one checkpoint or operation per epoch
 * - _checkpoints and _operations are always sorted in ascending order by epoch
 * - _currentEpoch being equal to the epoch of an operation means that
 *   operation is _not_ currently applied
 */
let ChatEditingCheckpointTimelineImpl = class ChatEditingCheckpointTimelineImpl {
    constructor(chatSessionResource, _delegate, _notebookEditorModelResolverService, _notebookService, _instantiationService, _modelService, _textModelService, _editorWorkerService, _configurationService) {
        this.chatSessionResource = chatSessionResource;
        this._delegate = _delegate;
        this._notebookEditorModelResolverService = _notebookEditorModelResolverService;
        this._notebookService = _notebookService;
        this._instantiationService = _instantiationService;
        this._modelService = _modelService;
        this._textModelService = _textModelService;
        this._editorWorkerService = _editorWorkerService;
        this._configurationService = _configurationService;
        this._epochCounter = 0;
        this._checkpoints = observableValue(this, []);
        this._currentEpoch = observableValue(this, 0);
        this._operations = observableValueOpts({ equalsFn: () => false }, []); // mutable
        this._fileBaselines = new Map(); // key: `${uri}::${requestId}`
        /** Gets the checkpoint, if any, we can 'undo' to. */
        this._willUndoToCheckpoint = derived(reader => {
            const currentEpoch = this._currentEpoch.read(reader);
            const checkpoints = this._checkpoints.read(reader);
            if (checkpoints.length < 2 || currentEpoch <= checkpoints[1].epoch) {
                return undefined;
            }
            const operations = this._operations.read(reader);
            // Undo either to right before the current request...
            const currentCheckpointIdx = findLastIdx(checkpoints, cp => cp.epoch < currentEpoch);
            const startOfRequest = currentCheckpointIdx === -1 ? undefined : findLast(checkpoints, cp => cp.undoStopId === undefined, currentCheckpointIdx);
            // Or to the checkpoint before the last operation in this request
            const previousOperation = findLast(operations, op => op.epoch < currentEpoch);
            const previousCheckpoint = previousOperation && findLast(checkpoints, cp => cp.epoch < previousOperation.epoch);
            if (!startOfRequest) {
                return previousCheckpoint;
            }
            if (!previousCheckpoint) {
                return startOfRequest;
            }
            // Special case: if we're undoing the first edit operation, undo the entire request
            if (!operations.some(op => op.epoch > startOfRequest.epoch && op.epoch < previousCheckpoint.epoch)) {
                return startOfRequest;
            }
            return previousCheckpoint.epoch > startOfRequest.epoch ? previousCheckpoint : startOfRequest;
        });
        this.canUndo = this._willUndoToCheckpoint.map(cp => !!cp);
        /**
         * Gets the epoch we'll redo this. Unlike undo this doesn't only use checkpoints
         * because we could potentially redo to a 'tip' operation that's not checkpointed yet.
         */
        this._willRedoToEpoch = derived(reader => {
            const currentEpoch = this._currentEpoch.read(reader);
            const operations = this._operations.read(reader);
            const checkpoints = this._checkpoints.read(reader);
            const maxEncounteredEpoch = Math.max(operations.at(-1)?.epoch || 0, checkpoints.at(-1)?.epoch || 0);
            if (currentEpoch > maxEncounteredEpoch) {
                return undefined;
            }
            // Find the next edit operation that would be applied...
            const nextOperation = operations.find(op => op.epoch >= currentEpoch);
            const nextCheckpoint = nextOperation && checkpoints.find(op => op.epoch > nextOperation.epoch);
            // And figure out where we're going if we're navigating across request
            // 1. If there is no next request or if the next target checkpoint is in
            //    the next request, navigate there.
            // 2. Otherwise, navigate to the end of the next request.
            const currentCheckpoint = findLast(checkpoints, cp => cp.epoch < currentEpoch);
            if (currentCheckpoint && nextOperation && currentCheckpoint.requestId !== nextOperation.requestId) {
                const startOfNextRequestIdx = findLastIdx(checkpoints, (cp, i) => cp.undoStopId === undefined && (checkpoints[i - 1]?.requestId === currentCheckpoint.requestId));
                const startOfNextRequest = startOfNextRequestIdx === -1 ? undefined : checkpoints[startOfNextRequestIdx];
                if (startOfNextRequest && nextOperation.requestId !== startOfNextRequest.requestId) {
                    const requestAfterTheNext = findFirst(checkpoints, op => op.undoStopId === undefined, startOfNextRequestIdx + 1);
                    if (requestAfterTheNext) {
                        return requestAfterTheNext.epoch;
                    }
                }
            }
            return Math.min(nextCheckpoint?.epoch || Infinity, (maxEncounteredEpoch + 1));
        });
        this.canRedo = this._willRedoToEpoch.map(e => !!e);
        this.requestDisablement = derivedOpts({ equalsFn: (a, b) => arraysEqual(a, b, objectsEqual) }, reader => {
            const currentEpoch = this._currentEpoch.read(reader);
            const operations = this._operations.read(reader);
            const checkpoints = this._checkpoints.read(reader);
            const maxEncounteredEpoch = Math.max(operations.at(-1)?.epoch || 0, checkpoints.at(-1)?.epoch || 0);
            if (currentEpoch > maxEncounteredEpoch) {
                return []; // common case -- nothing undone
            }
            const lastAppliedOperation = findLast(operations, op => op.epoch < currentEpoch)?.epoch || 0;
            const lastAppliedRequest = findLast(checkpoints, cp => cp.epoch < currentEpoch && cp.undoStopId === undefined)?.epoch || 0;
            const stopDisablingAtEpoch = Math.max(lastAppliedOperation, lastAppliedRequest);
            const disablement = new Map();
            // Go through the checkpoints and disable any until the one that contains the last applied operation.
            // Subtle: the request will first make a checkpoint with an 'undefined' undo
            // stop, and in this loop we'll "automatically" disable the entire request when
            // we reach that checkpoint.
            for (let i = checkpoints.length - 1; i >= 0; i--) {
                const { undoStopId, requestId, epoch } = checkpoints[i];
                if (epoch <= stopDisablingAtEpoch) {
                    break;
                }
                if (requestId) {
                    disablement.set(requestId, undoStopId);
                }
            }
            return [...disablement].map(([requestId, afterUndoStop]) => ({ requestId, afterUndoStop }));
        });
        this.createCheckpoint(undefined, undefined, 'Initial State', 'Starting point before any edits');
    }
    createCheckpoint(requestId, undoStopId, label, description) {
        const existingCheckpoints = this._checkpoints.get();
        const existing = existingCheckpoints.find(c => c.undoStopId === undoStopId && c.requestId === requestId);
        if (existing) {
            return existing.checkpointId;
        }
        const { checkpoints, operations } = this._getVisibleOperationsAndCheckpoints();
        const checkpointId = generateUuid();
        const epoch = this.incrementEpoch();
        checkpoints.push({
            checkpointId,
            requestId,
            undoStopId,
            epoch,
            label,
            description
        });
        transaction(tx => {
            this._checkpoints.set(checkpoints, tx);
            this._operations.set(operations, tx);
            this._currentEpoch.set(epoch + 1, tx);
        });
        return checkpointId;
    }
    async undoToLastCheckpoint() {
        const checkpoint = this._willUndoToCheckpoint.get();
        if (checkpoint) {
            await this.navigateToCheckpoint(checkpoint.checkpointId);
        }
    }
    async redoToNextCheckpoint() {
        const targetEpoch = this._willRedoToEpoch.get();
        if (targetEpoch) {
            await this._navigateToEpoch(targetEpoch);
        }
    }
    navigateToCheckpoint(checkpointId) {
        const targetCheckpoint = this._getCheckpoint(checkpointId);
        if (!targetCheckpoint) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }
        if (targetCheckpoint.undoStopId === undefined) {
            // If we're navigating to the start of a request, we want to restore the file
            // to whatever baseline we captured, _not_ the result state from the prior request
            // because there may have been user changes in the meantime. But we still want
            // to set the epoch marking that checkpoint as having been undone (the second
            // arg below) so that disablement works and so it's discarded if appropriate later.
            return this._navigateToEpoch(targetCheckpoint.epoch + 1, targetCheckpoint.epoch);
        }
        else {
            return this._navigateToEpoch(targetCheckpoint.epoch + 1);
        }
    }
    getContentURIAtStop(requestId, fileURI, stopId) {
        return ChatEditingSnapshotTextModelContentProvider.getSnapshotFileURI(this.chatSessionResource, requestId, stopId, fileURI.path);
    }
    async _navigateToEpoch(restoreToEpoch, navigateToEpoch = restoreToEpoch) {
        const currentEpoch = this._currentEpoch.get();
        if (currentEpoch !== restoreToEpoch) {
            const urisToRestore = await this._applyFileSystemOperations(currentEpoch, restoreToEpoch);
            // Reconstruct content for files affected by operations in the range
            await this._reconstructAllFileContents(restoreToEpoch, urisToRestore);
        }
        // Update current epoch
        this._currentEpoch.set(navigateToEpoch, undefined);
    }
    _getCheckpoint(checkpointId) {
        return this._checkpoints.get().find(c => c.checkpointId === checkpointId);
    }
    incrementEpoch() {
        return this._epochCounter++;
    }
    recordFileOperation(operation) {
        const { currentEpoch, checkpoints, operations } = this._getVisibleOperationsAndCheckpoints();
        if (operation.epoch < currentEpoch) {
            throw new Error(`Cannot record operation at epoch ${operation.epoch} when current epoch is ${currentEpoch}`);
        }
        operations.push(operation);
        transaction(tx => {
            this._checkpoints.set(checkpoints, tx);
            this._operations.set(operations, tx);
            this._currentEpoch.set(operation.epoch + 1, tx);
        });
    }
    _getVisibleOperationsAndCheckpoints() {
        const currentEpoch = this._currentEpoch.get();
        const checkpoints = this._checkpoints.get();
        const operations = this._operations.get();
        return {
            currentEpoch,
            checkpoints: checkpoints.filter(c => c.epoch < currentEpoch),
            operations: operations.filter(op => op.epoch < currentEpoch)
        };
    }
    recordFileBaseline(baseline) {
        const key = this._getBaselineKey(baseline.uri, baseline.requestId);
        this._fileBaselines.set(key, baseline);
    }
    _getFileBaseline(uri, requestId) {
        const key = this._getBaselineKey(uri, requestId);
        return this._fileBaselines.get(key);
    }
    hasFileBaseline(uri, requestId) {
        const key = this._getBaselineKey(uri, requestId);
        return this._fileBaselines.has(key);
    }
    async getContentAtStop(requestId, contentURI, stopId) {
        let toEpoch;
        if (stopId?.startsWith(STOP_ID_EPOCH_PREFIX)) {
            toEpoch = Number(stopId.slice(STOP_ID_EPOCH_PREFIX.length));
        }
        else {
            toEpoch = this._checkpoints.get().find(c => c.requestId === requestId && c.undoStopId === stopId)?.epoch;
        }
        // The content URI doesn't preserve the original scheme or authority. Look through
        // to find the operation that touched that path to get its actual URI
        const fileURI = this._getTimelineCanonicalUriForPath(contentURI);
        if (!toEpoch || !fileURI) {
            return '';
        }
        const baseline = await this._findBestBaselineForFile(fileURI, toEpoch, requestId);
        if (!baseline) {
            return '';
        }
        const operations = this._getFileOperationsInRange(fileURI, baseline.epoch, toEpoch);
        const replayed = await this._replayOperations(baseline, operations);
        return replayed.exists ? replayed.content : undefined;
    }
    _getTimelineCanonicalUriForPath(contentURI) {
        for (const it of [this._fileBaselines.values(), this._operations.get()]) {
            for (const thing of it) {
                if (thing.uri.path === contentURI.path) {
                    return thing.uri;
                }
            }
        }
        return undefined;
    }
    /**
     * Creates a callback that is invoked when data at the stop changes. This
     * will not fire initially and may be debounced internally.
     */
    onDidChangeContentsAtStop(requestId, contentURI, stopId, callback) {
        // The only case where we have data that updates is if we have an epoch pointer that's
        // after our know epochs (e.g. pointing to the end file state after all operations).
        // If this isn't the case, abort.
        if (!stopId || !stopId.startsWith(STOP_ID_EPOCH_PREFIX)) {
            return Disposable.None;
        }
        const target = Number(stopId.slice(STOP_ID_EPOCH_PREFIX.length));
        if (target <= this._epochCounter) {
            return Disposable.None; // already finalized
        }
        const store = new DisposableStore();
        const scheduler = store.add(new ThrottledDelayer(500));
        store.add(Event.fromObservableLight(this._operations)(() => {
            scheduler.trigger(async () => {
                if (this._operations.get().at(-1)?.epoch >= target) {
                    store.dispose();
                }
                const content = await this.getContentAtStop(requestId, contentURI, stopId);
                if (content !== undefined) {
                    callback(content);
                }
            });
        }));
        return store;
    }
    _getCheckpointBeforeEpoch(epoch, reader) {
        return findLast(this._checkpoints.read(reader), c => c.epoch <= epoch);
    }
    async _reconstructFileState(uri, targetEpoch) {
        const targetCheckpoint = this._getCheckpointBeforeEpoch(targetEpoch);
        if (!targetCheckpoint) {
            throw new Error(`Checkpoint for epoch ${targetEpoch} not found`);
        }
        // Find the most appropriate baseline for this file
        const baseline = await this._findBestBaselineForFile(uri, targetEpoch, targetCheckpoint.requestId || '');
        if (!baseline) {
            // File doesn't exist at this checkpoint
            return {
                exists: false,
                uri,
            };
        }
        // Get operations that affect this file from baseline to target checkpoint
        const operations = this._getFileOperationsInRange(uri, baseline.epoch, targetEpoch);
        // Replay operations to reconstruct state
        return this._replayOperations(baseline, operations);
    }
    getStateForPersistence() {
        return {
            checkpoints: this._checkpoints.get(),
            currentEpoch: this._currentEpoch.get(),
            fileBaselines: [...this._fileBaselines],
            operations: this._operations.get(),
            epochCounter: this._epochCounter,
        };
    }
    restoreFromState(state, tx) {
        this._checkpoints.set(state.checkpoints, tx);
        this._currentEpoch.set(state.currentEpoch, tx);
        this._operations.set(state.operations.slice(), tx);
        this._epochCounter = state.epochCounter;
        this._fileBaselines.clear();
        for (const [key, baseline] of state.fileBaselines) {
            this._fileBaselines.set(key, baseline);
        }
    }
    getCheckpointIdForRequest(requestId, undoStopId) {
        const checkpoints = this._checkpoints.get();
        return checkpoints.find(c => c.requestId === requestId && c.undoStopId === undoStopId)?.checkpointId;
    }
    async _reconstructAllFileContents(targetEpoch, filesToReconstruct) {
        await Promise.all(Array.from(filesToReconstruct).map(async (uri) => {
            const reconstructedState = await this._reconstructFileState(uri, targetEpoch);
            if (reconstructedState.exists) {
                await this._delegate.setContents(reconstructedState.uri, reconstructedState.content, reconstructedState.telemetryInfo);
            }
        }));
    }
    _getBaselineKey(uri, requestId) {
        return `${uri.toString()}::${requestId}`;
    }
    async _findBestBaselineForFile(uri, epoch, requestId) {
        // First, iterate backwards through operations before the target checkpoint
        // to see if the file was created/re-created more recently than any baseline
        let currentRequestId = requestId;
        const operations = this._operations.get();
        for (let i = operations.length - 1; i >= 0; i--) {
            const operation = operations[i];
            if (operation.epoch > epoch) {
                continue;
            }
            // If the file was just created, use that as its updated baseline
            if (operation.type === FileOperationType.Create && isEqual(operation.uri, uri)) {
                return {
                    uri: operation.uri,
                    requestId: operation.requestId,
                    content: operation.initialContent,
                    epoch: operation.epoch,
                    telemetryInfo: operation.telemetryInfo,
                };
            }
            // If the file was renamed to this URI, use its old contents as the baseline
            if (operation.type === FileOperationType.Rename && isEqual(operation.newUri, uri)) {
                const prev = await this._findBestBaselineForFile(operation.oldUri, operation.epoch, operation.requestId);
                if (!prev) {
                    return undefined;
                }
                const operations = this._getFileOperationsInRange(operation.oldUri, prev.epoch, operation.epoch);
                const replayed = await this._replayOperations(prev, operations);
                return {
                    uri: uri,
                    epoch: operation.epoch,
                    content: replayed.exists ? replayed.content : '',
                    requestId: operation.requestId,
                    telemetryInfo: prev.telemetryInfo,
                    notebookViewType: replayed.exists ? replayed.notebookViewType : undefined,
                };
            }
            // When the request ID changes, check if we have a baseline for the current request
            if (currentRequestId && operation.requestId !== currentRequestId) {
                const baseline = this._getFileBaseline(uri, currentRequestId);
                if (baseline) {
                    return baseline;
                }
            }
            currentRequestId = operation.requestId;
        }
        // Check the final request ID for a baseline
        return this._getFileBaseline(uri, currentRequestId);
    }
    _getFileOperationsInRange(uri, fromEpoch, toEpoch) {
        return this._operations.get().filter(op => {
            const cellUri = CellUri.parse(op.uri);
            return op.epoch >= fromEpoch &&
                op.epoch < toEpoch &&
                (isEqual(op.uri, uri) || (cellUri && isEqual(cellUri.notebook, uri)));
        }).sort((a, b) => a.epoch - b.epoch);
    }
    async _replayOperations(baseline, operations) {
        let currentState = {
            exists: true,
            content: baseline.content,
            uri: baseline.uri,
            telemetryInfo: baseline.telemetryInfo,
        };
        if (baseline.notebookViewType) {
            currentState.notebook = await this._notebookEditorModelResolverService.createUntitledNotebookTextModel(baseline.notebookViewType);
            if (baseline.content) {
                restoreNotebookSnapshot(currentState.notebook, baseline.content);
            }
        }
        for (const operation of operations) {
            currentState = await this._applyOperationToState(currentState, operation, baseline.telemetryInfo);
        }
        if (currentState.exists && currentState.notebook) {
            const info = await this._notebookService.withNotebookDataProvider(currentState.notebook.viewType);
            currentState.content = createNotebookSnapshot(currentState.notebook, info.serializer.options, this._configurationService);
            currentState.notebook.dispose();
        }
        return currentState;
    }
    async _applyOperationToState(state, operation, telemetryInfo) {
        switch (operation.type) {
            case FileOperationType.Create: {
                if (state.exists && state.notebook) {
                    state.notebook.dispose();
                }
                let notebook;
                if (operation.notebookViewType) {
                    notebook = await this._notebookEditorModelResolverService.createUntitledNotebookTextModel(operation.notebookViewType);
                    if (operation.initialContent) {
                        restoreNotebookSnapshot(notebook, operation.initialContent);
                    }
                }
                return {
                    exists: true,
                    content: operation.initialContent,
                    uri: operation.uri,
                    telemetryInfo,
                    notebookViewType: operation.notebookViewType,
                    notebook,
                };
            }
            case FileOperationType.Delete:
                if (state.exists && state.notebook) {
                    state.notebook.dispose();
                }
                return {
                    exists: false,
                    uri: operation.uri
                };
            case FileOperationType.Rename:
                return {
                    ...state,
                    uri: operation.newUri
                };
            case FileOperationType.TextEdit: {
                if (!state.exists) {
                    throw new Error('Cannot apply text edits to non-existent file');
                }
                const nbCell = operation.cellIndex !== undefined && state.notebook?.cells.at(operation.cellIndex);
                if (nbCell) {
                    const newContent = this._applyTextEditsToContent(nbCell.getValue(), operation.edits);
                    state.notebook.applyEdits([{
                            editType: 1 /* CellEditType.Replace */,
                            index: operation.cellIndex,
                            count: 1,
                            cells: [{ cellKind: nbCell.cellKind, language: nbCell.language, mime: nbCell.language, source: newContent, outputs: nbCell.outputs }]
                        }], true, undefined, () => undefined, undefined);
                    return state;
                }
                // Apply text edits using a temporary text model
                return {
                    ...state,
                    content: this._applyTextEditsToContent(state.content, operation.edits)
                };
            }
            case FileOperationType.NotebookEdit:
                if (!state.exists) {
                    throw new Error('Cannot apply notebook edits to non-existent file');
                }
                if (!state.notebook) {
                    throw new Error('Cannot apply notebook edits to non-notebook file');
                }
                state.notebook.applyEdits(operation.cellEdits.slice(), true, undefined, () => undefined, undefined);
                return state;
            default:
                assertNever(operation);
        }
    }
    async _applyFileSystemOperations(fromEpoch, toEpoch) {
        const isMovingForward = toEpoch > fromEpoch;
        const operations = this._operations.get().filter(op => {
            if (isMovingForward) {
                return op.epoch >= fromEpoch && op.epoch < toEpoch;
            }
            else {
                return op.epoch < fromEpoch && op.epoch >= toEpoch;
            }
        }).sort((a, b) => isMovingForward ? a.epoch - b.epoch : b.epoch - a.epoch);
        // Apply file system operations in the correct direction
        const urisToRestore = new ResourceSet();
        for (const operation of operations) {
            await this._applyFileSystemOperation(operation, isMovingForward, urisToRestore);
        }
        return urisToRestore;
    }
    async _applyFileSystemOperation(operation, isMovingForward, urisToRestore) {
        switch (operation.type) {
            case FileOperationType.Create:
                if (isMovingForward) {
                    await this._delegate.createFile(operation.uri, operation.initialContent);
                    urisToRestore.add(operation.uri);
                }
                else {
                    await this._delegate.deleteFile(operation.uri);
                    urisToRestore.delete(operation.uri);
                }
                break;
            case FileOperationType.Delete:
                if (isMovingForward) {
                    await this._delegate.deleteFile(operation.uri);
                    urisToRestore.delete(operation.uri);
                }
                else {
                    await this._delegate.createFile(operation.uri, operation.finalContent);
                    urisToRestore.add(operation.uri);
                }
                break;
            case FileOperationType.Rename:
                if (isMovingForward) {
                    await this._delegate.renameFile(operation.oldUri, operation.newUri);
                    urisToRestore.delete(operation.oldUri);
                    urisToRestore.add(operation.newUri);
                }
                else {
                    await this._delegate.renameFile(operation.newUri, operation.oldUri);
                    urisToRestore.delete(operation.newUri);
                    urisToRestore.add(operation.oldUri);
                }
                break;
            // Text and notebook edits don't affect file system structure
            case FileOperationType.TextEdit:
            case FileOperationType.NotebookEdit:
                urisToRestore.add(CellUri.parse(operation.uri)?.notebook ?? operation.uri);
                break;
            default:
                assertNever(operation);
        }
    }
    _applyTextEditsToContent(content, edits) {
        // Use the example pattern provided by the user
        const makeModel = (uri, contents) => this._instantiationService.createInstance(TextModel, contents, '', this._modelService.getCreationOptions('', uri, true), uri);
        // Create a temporary URI for the model
        const tempUri = URI.from({ scheme: 'temp', path: `/temp-${Date.now()}.txt` });
        const model = makeModel(tempUri, content);
        try {
            // Apply edits
            model.applyEdits(edits.map(edit => ({
                range: {
                    startLineNumber: edit.range.startLineNumber,
                    startColumn: edit.range.startColumn,
                    endLineNumber: edit.range.endLineNumber,
                    endColumn: edit.range.endColumn
                },
                text: edit.text
            })));
            return model.getValue();
        }
        finally {
            model.dispose();
        }
    }
    getEntryDiffBetweenStops(uri, requestId, stopId) {
        const epochs = derivedOpts({ equalsFn: (a, b) => a.start === b.start && a.end === b.end }, reader => {
            const checkpoints = this._checkpoints.read(reader);
            const startIndex = checkpoints.findIndex(c => c.requestId === requestId && c.undoStopId === stopId);
            return { start: checkpoints[startIndex], end: checkpoints[startIndex + 1] };
        });
        return this._getEntryDiffBetweenEpochs(uri, epochs);
    }
    getEntryDiffBetweenRequests(uri, startRequestId, stopRequestId) {
        const epochs = derivedOpts({ equalsFn: (a, b) => a.start === b.start && a.end === b.end }, reader => {
            const checkpoints = this._checkpoints.read(reader);
            const startIndex = checkpoints.findIndex(c => c.requestId === startRequestId);
            const start = startIndex === -1 ? checkpoints[0] : checkpoints[startIndex];
            const end = checkpoints.find(c => c.requestId === stopRequestId) || findFirst(checkpoints, c => c.requestId !== startRequestId, startIndex) || checkpoints[checkpoints.length - 1];
            return { start, end };
        });
        return this._getEntryDiffBetweenEpochs(uri, epochs);
    }
    _getEntryDiffBetweenEpochs(uri, epochs) {
        const modelRefsPromise = derived(this, (reader) => {
            const { start, end } = epochs.read(reader);
            if (!start) {
                return undefined;
            }
            const store = reader.store.add(new DisposableStore());
            const promise = Promise.all([
                this._textModelService.createModelReference(this.getContentURIAtStop(start.requestId || START_REQUEST_EPOCH, uri, STOP_ID_EPOCH_PREFIX + start.epoch)),
                this._textModelService.createModelReference(this.getContentURIAtStop(end?.requestId || start.requestId || START_REQUEST_EPOCH, uri, STOP_ID_EPOCH_PREFIX + (end?.epoch || Number.MAX_SAFE_INTEGER))),
            ]).then(refs => {
                if (store.isDisposed) {
                    refs.forEach(r => r.dispose());
                }
                else {
                    refs.forEach(r => store.add(r));
                }
                return { refs, isFinal: !!end };
            });
            return new ObservablePromise(promise);
        });
        const resolvedModels = derived(reader => {
            const refs2 = modelRefsPromise.read(reader)?.promiseResult.read(reader);
            return refs2?.data && {
                isFinal: refs2.data.isFinal,
                refs: refs2.data.refs.map(r => ({
                    model: r.object.textEditorModel,
                    onChange: observableSignalFromEvent(this, r.object.textEditorModel.onDidChangeContent.bind(r.object.textEditorModel)),
                })),
            };
        });
        const diff = derived((reader) => {
            const modelsData = resolvedModels.read(reader);
            if (!modelsData) {
                return;
            }
            const { refs, isFinal } = modelsData;
            refs.forEach(m => m.onChange.read(reader)); // re-read when contents change
            const promise = this._computeDiff(refs[0].model.uri, refs[1].model.uri, isFinal);
            return new ObservablePromise(promise);
        });
        return derived(reader => {
            return diff.read(reader)?.promiseResult.read(reader)?.data || undefined;
        });
    }
    _computeDiff(originalUri, modifiedUri, isFinal) {
        return this._editorWorkerService.computeDiff(originalUri, modifiedUri, { ignoreTrimWhitespace: false, computeMoves: false, maxComputationTimeMs: 3000 }, 'advanced').then((diff) => {
            const entryDiff = {
                originalURI: originalUri,
                modifiedURI: modifiedUri,
                identical: !!diff?.identical,
                isFinal,
                quitEarly: !diff || diff.quitEarly,
                added: 0,
                removed: 0,
            };
            if (diff) {
                for (const change of diff.changes) {
                    entryDiff.removed += change.original.endLineNumberExclusive - change.original.startLineNumber;
                    entryDiff.added += change.modified.endLineNumberExclusive - change.modified.startLineNumber;
                }
            }
            return entryDiff;
        });
    }
};
ChatEditingCheckpointTimelineImpl = __decorate([
    __param(2, INotebookEditorModelResolverService),
    __param(3, INotebookService),
    __param(4, IInstantiationService),
    __param(5, IModelService),
    __param(6, ITextModelService),
    __param(7, IEditorWorkerService),
    __param(8, IConfigurationService)
], ChatEditingCheckpointTimelineImpl);
export { ChatEditingCheckpointTimelineImpl };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdDaGVja3BvaW50VGltZWxpbmVJbXBsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ0NoZWNrcG9pbnRUaW1lbGluZUltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE1BQU0sSUFBSSxXQUFXLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM1RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDdkUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLE1BQU0seUNBQXlDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxNQUFNLElBQUksWUFBWSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDL0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQXNDLGlCQUFpQixFQUFFLHlCQUF5QixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNyTixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFbEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUVsRSxPQUFPLEVBQUUs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