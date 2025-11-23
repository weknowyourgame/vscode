/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { transaction } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { INotebookService } from '../../../notebook/common/notebookService.js';
import { ChatEditingCheckpointTimelineImpl } from '../../browser/chatEditing/chatEditingCheckpointTimelineImpl.js';
import { FileOperationType } from '../../browser/chatEditing/chatEditingOperations.js';
suite('ChatEditingCheckpointTimeline', function () {
    const store = new DisposableStore();
    let timeline;
    let fileContents;
    let fileDelegate;
    const DEFAULT_TELEMETRY_INFO = upcastPartial({
        agentId: 'testAgent',
        command: undefined,
        sessionResource: URI.parse('chat://test-session'),
        requestId: 'test-request',
        result: undefined,
        modelId: undefined,
        modeId: undefined,
        applyCodeBlockSuggestionId: undefined,
        feature: undefined,
    });
    function createTextEditOperation(uri, requestId, epoch, edits) {
        return upcastPartial({
            type: FileOperationType.TextEdit,
            uri,
            requestId,
            epoch,
            edits
        });
    }
    function createFileCreateOperation(uri, requestId, epoch, initialContent) {
        return upcastPartial({
            type: FileOperationType.Create,
            uri,
            requestId,
            epoch,
            initialContent
        });
    }
    function createFileDeleteOperation(uri, requestId, epoch, finalContent) {
        return upcastPartial({
            type: FileOperationType.Delete,
            uri,
            requestId,
            epoch,
            finalContent
        });
    }
    function createFileRenameOperation(oldUri, newUri, requestId, epoch) {
        return upcastPartial({
            type: FileOperationType.Rename,
            uri: newUri,
            requestId,
            epoch,
            oldUri,
            newUri
        });
    }
    setup(function () {
        fileContents = new ResourceMap();
        fileDelegate = {
            createFile: async (uri, initialContent) => {
                fileContents.set(uri, initialContent);
            },
            deleteFile: async (uri) => {
                fileContents.delete(uri);
            },
            renameFile: async (fromUri, toUri) => {
                const content = fileContents.get(fromUri);
                if (content !== undefined) {
                    fileContents.set(toUri, content);
                    fileContents.delete(fromUri);
                }
            },
            setContents: async (uri, content) => {
                fileContents.set(uri, content);
            }
        };
        const collection = new ServiceCollection();
        collection.set(INotebookService, new SyncDescriptor(TestNotebookService));
        const insta = store.add(workbenchInstantiationService(undefined, store).createChild(collection));
        timeline = insta.createInstance(ChatEditingCheckpointTimelineImpl, URI.parse('chat://test-session'), fileDelegate);
    });
    teardown(() => {
        store.clear();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('creates initial checkpoint on construction', function () {
        const checkpoints = timeline.getStateForPersistence().checkpoints;
        assert.strictEqual(checkpoints.length, 1);
        assert.strictEqual(checkpoints[0].requestId, undefined);
        assert.strictEqual(checkpoints[0].label, 'Initial State');
    });
    test('canUndo and canRedo are initially false', function () {
        assert.strictEqual(timeline.canUndo.get(), false);
        assert.strictEqual(timeline.canRedo.get(), false);
    });
    test('createCheckpoint increments epoch and creates checkpoint', function () {
        const initialEpoch = timeline.getStateForPersistence().epochCounter;
        timeline.createCheckpoint('req1', 'stop1', 'Checkpoint 1');
        const state = timeline.getStateForPersistence();
        assert.strictEqual(state.checkpoints.length, 2); // Initial + new checkpoint
        assert.strictEqual(state.checkpoints[1].requestId, 'req1');
        assert.strictEqual(state.checkpoints[1].undoStopId, 'stop1');
        assert.strictEqual(state.checkpoints[1].label, 'Checkpoint 1');
        assert.strictEqual(state.epochCounter, initialEpoch + 1);
    });
    test('createCheckpoint does not create duplicate checkpoints', function () {
        timeline.createCheckpoint('req1', 'stop1', 'Checkpoint 1');
        timeline.createCheckpoint('req1', 'stop1', 'Checkpoint 1 Duplicate');
        const checkpoints = timeline.getStateForPersistence().checkpoints;
        assert.strictEqual(checkpoints.length, 2); // Only initial + first checkpoint
        assert.strictEqual(checkpoints[1].label, 'Checkpoint 1'); // Original label preserved
    });
    test('incrementEpoch increases epoch counter', function () {
        const initialEpoch = timeline.getStateForPersistence().epochCounter;
        const epoch1 = timeline.incrementEpoch();
        const epoch2 = timeline.incrementEpoch();
        assert.strictEqual(epoch1, initialEpoch);
        assert.strictEqual(epoch2, initialEpoch + 1);
        assert.strictEqual(timeline.getStateForPersistence().epochCounter, initialEpoch + 2);
    });
    test('recordFileBaseline stores baseline', function () {
        const uri = URI.parse('file:///test.txt');
        const baseline = upcastPartial({
            uri,
            requestId: 'req1',
            content: 'initial content',
            epoch: 1,
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        });
        timeline.recordFileBaseline(baseline);
        assert.strictEqual(timeline.hasFileBaseline(uri, 'req1'), true);
        assert.strictEqual(timeline.hasFileBaseline(uri, 'req2'), false);
    });
    test('recordFileOperation stores operation', function () {
        const uri = URI.parse('file:///test.txt');
        const operation = createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 1), text: 'hello' }]);
        timeline.recordFileOperation(operation);
        const state = timeline.getStateForPersistence();
        assert.strictEqual(state.operations.length, 1);
        assert.strictEqual(state.operations[0].type, FileOperationType.TextEdit);
        assert.strictEqual(state.operations[0].requestId, 'req1');
    });
    test('basic undo/redo with text edits', async function () {
        const uri = URI.parse('file:///test.txt');
        // Record baseline
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'hello',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        // Create checkpoint before edit - marks state with baseline
        timeline.createCheckpoint('req1', undefined, 'Start of Request');
        // Record edit at a new epoch
        const editEpoch = timeline.incrementEpoch();
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', editEpoch, [{ range: new Range(1, 1, 1, 6), text: 'goodbye' }]));
        // Create checkpoint after edit - marks state with edit applied
        timeline.createCheckpoint('req1', 'stop1', 'After Edit');
        // canUndo and canRedo are based on checkpoint positions, not delegate state
        // We have: Initial, Start of Request, After Edit
        // Current epoch is after 'After Edit', so we can undo but not redo
        assert.strictEqual(timeline.canUndo.get(), true);
        assert.strictEqual(timeline.canRedo.get(), false);
        // Undo (goes to start of request)
        await timeline.undoToLastCheckpoint();
        // After undoing to start of request, we can't undo within this request anymore
        // but we can redo to the 'stop1' checkpoint
        assert.strictEqual(timeline.canUndo.get(), false); // No more undo stops in req1 before this
        assert.strictEqual(timeline.canRedo.get(), true); // Can redo to 'stop1'
        // Redo
        await timeline.redoToNextCheckpoint();
        // After redo to 'stop1', we can undo again
        assert.strictEqual(timeline.canUndo.get(), true);
        // canRedo might still be true if currentEpoch is less than the max epoch
        // This is because checkpoints are created with incrementEpoch, so there are epochs after them
    });
    test('file creation and deletion operations', async function () {
        const uri = URI.parse('file:///new.txt');
        // Create file
        const createEpoch = timeline.incrementEpoch();
        // Record baseline for the created file
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'new file content',
            epoch: createEpoch,
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.recordFileOperation(createFileCreateOperation(uri, 'req1', createEpoch, 'new file content'));
        // Checkpoint marks state after file creation
        timeline.createCheckpoint('req1', 'created', 'File Created');
        // Navigate to initial to sync delegate, then to created
        await timeline.navigateToCheckpoint(timeline.getStateForPersistence().checkpoints[0].checkpointId);
        assert.strictEqual(fileContents.has(uri), false);
        // Navigate to created checkpoint
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'created'));
        assert.strictEqual(fileContents.get(uri), 'new file content');
        // Delete file
        const deleteEpoch = timeline.incrementEpoch();
        timeline.recordFileOperation(createFileDeleteOperation(uri, 'req1', deleteEpoch, 'new file content'));
        timeline.createCheckpoint('req1', 'deleted', 'File Deleted');
        // Navigate back to initial, then to deleted to properly apply operations
        await timeline.navigateToCheckpoint(timeline.getStateForPersistence().checkpoints[0].checkpointId);
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'deleted'));
        assert.strictEqual(fileContents.has(uri), false);
        // Undo deletion - goes back to 'created' checkpoint
        await timeline.undoToLastCheckpoint();
        assert.strictEqual(fileContents.get(uri), 'new file content');
        // Undo creation - goes back to initial state
        await timeline.undoToLastCheckpoint();
        assert.strictEqual(fileContents.has(uri), false);
    });
    test('file rename operations', async function () {
        const oldUri = URI.parse('file:///old.txt');
        const newUri = URI.parse('file:///new.txt');
        // Create initial file
        const createEpoch = timeline.incrementEpoch();
        // Record baseline for the created file
        timeline.recordFileBaseline(upcastPartial({
            uri: oldUri,
            requestId: 'req1',
            content: 'content',
            epoch: createEpoch,
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.recordFileOperation(createFileCreateOperation(oldUri, 'req1', createEpoch, 'content'));
        timeline.createCheckpoint('req1', 'created', 'File Created');
        // Navigate to initial, then to created to apply create operation
        await timeline.navigateToCheckpoint(timeline.getStateForPersistence().checkpoints[0].checkpointId);
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'created'));
        assert.strictEqual(fileContents.get(oldUri), 'content');
        // Rename file
        const renameEpoch = timeline.incrementEpoch();
        timeline.recordFileOperation(createFileRenameOperation(oldUri, newUri, 'req1', renameEpoch));
        timeline.createCheckpoint('req1', 'renamed', 'File Renamed');
        // Navigate back to initial, then to renamed to properly apply operations
        await timeline.navigateToCheckpoint(timeline.getStateForPersistence().checkpoints[0].checkpointId);
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'renamed'));
        assert.strictEqual(fileContents.has(oldUri), false);
        assert.strictEqual(fileContents.get(newUri), 'content');
        // Undo rename - goes back to 'created' checkpoint
        await timeline.undoToLastCheckpoint();
        assert.strictEqual(fileContents.get(oldUri), 'content');
        assert.strictEqual(fileContents.has(newUri), false);
    });
    test('multiple sequential edits to same file', async function () {
        const uri = URI.parse('file:///test.txt');
        // Record baseline
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'line1\nline2\nline3',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.createCheckpoint('req1', undefined, 'Start');
        // First edit
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 6), text: 'LINE1' }]));
        timeline.createCheckpoint('req1', 'edit1', 'Edit 1');
        // Second edit
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(2, 1, 2, 6), text: 'LINE2' }]));
        timeline.createCheckpoint('req1', 'edit2', 'Edit 2');
        // Navigate to first edit
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'edit1'));
        assert.strictEqual(fileContents.get(uri), 'LINE1\nline2\nline3');
        // Navigate to second edit
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'edit2'));
        assert.strictEqual(fileContents.get(uri), 'LINE1\nLINE2\nline3');
        // Navigate back to start
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', undefined));
        assert.strictEqual(fileContents.get(uri), 'line1\nline2\nline3');
    });
    test('getCheckpointIdForRequest returns correct checkpoint', function () {
        timeline.createCheckpoint('req1', undefined, 'Start of req1');
        timeline.createCheckpoint('req1', 'stop1', 'Stop 1');
        timeline.createCheckpoint('req2', undefined, 'Start of req2');
        const req1Start = timeline.getCheckpointIdForRequest('req1', undefined);
        const req1Stop = timeline.getCheckpointIdForRequest('req1', 'stop1');
        const req2Start = timeline.getCheckpointIdForRequest('req2', undefined);
        assert.ok(req1Start);
        assert.ok(req1Stop);
        assert.ok(req2Start);
        assert.notStrictEqual(req1Start, req1Stop);
        assert.notStrictEqual(req1Start, req2Start);
    });
    test('getCheckpointIdForRequest returns undefined for non-existent checkpoint', function () {
        const checkpoint = timeline.getCheckpointIdForRequest('nonexistent', 'stop1');
        assert.strictEqual(checkpoint, undefined);
    });
    test('requestDisablement tracks disabled requests', async function () {
        const uri = URI.parse('file:///test.txt');
        timeline.createCheckpoint('req1', undefined, 'Start req1');
        timeline.recordFileOperation(createFileCreateOperation(uri, 'req1', timeline.incrementEpoch(), 'a'));
        timeline.createCheckpoint('req1', 'stop1', 'Stop req1');
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 2), text: 'b' }]));
        timeline.createCheckpoint('req2', undefined, 'Start req2');
        timeline.recordFileOperation(createTextEditOperation(uri, 'req2', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 2), text: 'c' }]));
        // Undo sequence:
        assert.deepStrictEqual(timeline.requestDisablement.get(), []);
        await timeline.undoToLastCheckpoint();
        assert.strictEqual(fileContents.get(uri), 'b');
        assert.deepStrictEqual(timeline.requestDisablement.get(), [
            { requestId: 'req2', afterUndoStop: undefined },
        ]);
        await timeline.undoToLastCheckpoint();
        assert.strictEqual(fileContents.get(uri), 'a');
        assert.deepStrictEqual(timeline.requestDisablement.get(), [
            { requestId: 'req2', afterUndoStop: undefined },
            { requestId: 'req1', afterUndoStop: 'stop1' },
        ]);
        await timeline.undoToLastCheckpoint();
        assert.strictEqual(fileContents.get(uri), undefined);
        assert.deepStrictEqual(timeline.requestDisablement.get(), [
            { requestId: 'req2', afterUndoStop: undefined },
            { requestId: 'req1', afterUndoStop: undefined },
        ]);
        // Redo sequence:
        await timeline.redoToNextCheckpoint();
        assert.strictEqual(fileContents.get(uri), 'a');
        assert.deepStrictEqual(timeline.requestDisablement.get(), [
            { requestId: 'req2', afterUndoStop: undefined },
            { requestId: 'req1', afterUndoStop: 'stop1' },
        ]);
        await timeline.redoToNextCheckpoint();
        assert.strictEqual(fileContents.get(uri), 'b');
        assert.deepStrictEqual(timeline.requestDisablement.get(), [
            { requestId: 'req2', afterUndoStop: undefined },
        ]);
        await timeline.redoToNextCheckpoint();
        assert.strictEqual(fileContents.get(uri), 'c');
    });
    test('persistence - save and restore state', function () {
        const uri = URI.parse('file:///test.txt');
        // Setup some state
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'initial',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.createCheckpoint('req1', undefined, 'Start');
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 8), text: 'modified' }]));
        timeline.createCheckpoint('req1', 'stop1', 'Edit Complete');
        // Save state
        const savedState = timeline.getStateForPersistence();
        // Create new timeline and restore
        const collection = new ServiceCollection();
        collection.set(INotebookService, new SyncDescriptor(TestNotebookService));
        const insta = store.add(workbenchInstantiationService(undefined, store).createChild(collection));
        const newTimeline = insta.createInstance(ChatEditingCheckpointTimelineImpl, URI.parse('chat://test-session-2'), fileDelegate);
        transaction(tx => {
            newTimeline.restoreFromState(savedState, tx);
        });
        // Verify state was restored
        const restoredState = newTimeline.getStateForPersistence();
        assert.strictEqual(restoredState.checkpoints.length, savedState.checkpoints.length);
        assert.strictEqual(restoredState.operations.length, savedState.operations.length);
        assert.strictEqual(restoredState.currentEpoch, savedState.currentEpoch);
        assert.strictEqual(restoredState.epochCounter, savedState.epochCounter);
    });
    test('navigating between multiple requests', async function () {
        const uri1 = URI.parse('file:///file1.txt');
        const uri2 = URI.parse('file:///file2.txt');
        // Request 1 - create file
        timeline.createCheckpoint('req1', undefined, 'Start req1');
        const create1Epoch = timeline.incrementEpoch();
        timeline.recordFileBaseline(upcastPartial({
            uri: uri1,
            requestId: 'req1',
            content: 'file1 modified',
            epoch: create1Epoch,
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.recordFileOperation(createFileCreateOperation(uri1, 'req1', create1Epoch, 'file1 modified'));
        timeline.createCheckpoint('req1', 'stop1', 'Req1 complete');
        // Request 2 - create another file
        timeline.createCheckpoint('req2', undefined, 'Start req2');
        const create2Epoch = timeline.incrementEpoch();
        timeline.recordFileBaseline(upcastPartial({
            uri: uri2,
            requestId: 'req2',
            content: 'file2 modified',
            epoch: create2Epoch,
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.recordFileOperation(createFileCreateOperation(uri2, 'req2', create2Epoch, 'file2 modified'));
        timeline.createCheckpoint('req2', 'stop1', 'Req2 complete');
        // Navigate to initial, then to req1 completion to apply its operations
        await timeline.navigateToCheckpoint(timeline.getStateForPersistence().checkpoints[0].checkpointId);
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'stop1'));
        assert.strictEqual(fileContents.get(uri1), 'file1 modified');
        assert.strictEqual(fileContents.has(uri2), false); // req2 hasn't happened yet
        // Navigate to req2 completion
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req2', 'stop1'));
        assert.strictEqual(fileContents.get(uri1), 'file1 modified');
        assert.strictEqual(fileContents.get(uri2), 'file2 modified');
        // Navigate back to initial state by getting the first checkpoint
        const initialCheckpoint = timeline.getStateForPersistence().checkpoints[0];
        await timeline.navigateToCheckpoint(initialCheckpoint.checkpointId);
        assert.strictEqual(fileContents.has(uri1), false);
        assert.strictEqual(fileContents.has(uri2), false);
    });
    test('getContentURIAtStop returns snapshot URI', function () {
        const fileUri = URI.parse('file:///test.txt');
        const snapshotUri = timeline.getContentURIAtStop('req1', fileUri, 'stop1');
        assert.ok(snapshotUri);
        assert.notStrictEqual(snapshotUri.toString(), fileUri.toString());
        assert.ok(snapshotUri.toString().includes('req1'));
    });
    test('undoing entire request when appropriate', async function () {
        const uri = URI.parse('file:///test.txt');
        // Create initial baseline and checkpoint
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'initial',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.createCheckpoint('req1', undefined, 'Start req1');
        // Single edit with checkpoint
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 8), text: 'modified' }]));
        timeline.createCheckpoint('req1', 'stop1', 'Edit complete');
        // Should be able to undo
        assert.strictEqual(timeline.canUndo.get(), true);
        // Undo should go back to start of request, not just previous checkpoint
        await timeline.undoToLastCheckpoint();
        // Verify we're at the start of req1, which has epoch 2 (0 = initial, 1 = baseline, 2 = start checkpoint)
        const state = timeline.getStateForPersistence();
        assert.strictEqual(state.currentEpoch, 2); // Should be at the "Start req1" checkpoint epoch
    });
    test('operations use incrementing epochs', function () {
        const uri = URI.parse('file:///test.txt');
        const epoch1 = timeline.incrementEpoch();
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', epoch1, [{ range: new Range(1, 1, 1, 1), text: 'edit1' }]));
        const epoch2 = timeline.incrementEpoch();
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', epoch2, [{ range: new Range(2, 1, 2, 1), text: 'edit2' }]));
        // Both operations should be recorded
        const operations = timeline.getStateForPersistence().operations;
        assert.strictEqual(operations.length, 2);
        assert.strictEqual(operations[0].epoch, epoch1);
        assert.strictEqual(operations[1].epoch, epoch2);
    });
    test('navigateToCheckpoint throws error for invalid checkpoint ID', async function () {
        let errorThrown = false;
        try {
            await timeline.navigateToCheckpoint('invalid-checkpoint-id');
        }
        catch (error) {
            errorThrown = true;
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('not found'));
        }
        assert.ok(errorThrown, 'Expected error to be thrown');
    });
    test('navigateToCheckpoint does nothing when already at target epoch', async function () {
        const uri = URI.parse('file:///test.txt');
        // Record baseline and operation
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'initial',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        const createEpoch = timeline.incrementEpoch();
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', createEpoch, [{ range: new Range(1, 1, 1, 8), text: 'modified' }]));
        timeline.createCheckpoint('req1', 'stop1', 'Checkpoint');
        // Navigate to checkpoint
        const checkpointId = timeline.getCheckpointIdForRequest('req1', 'stop1');
        await timeline.navigateToCheckpoint(checkpointId);
        // Navigate again to same checkpoint - should be a no-op
        const stateBefore = timeline.getStateForPersistence();
        await timeline.navigateToCheckpoint(checkpointId);
        const stateAfter = timeline.getStateForPersistence();
        assert.strictEqual(stateBefore.currentEpoch, stateAfter.currentEpoch);
    });
    test('recording operation after undo truncates future history', async function () {
        const uri = URI.parse('file:///test.txt');
        // Setup initial operations
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'initial',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.createCheckpoint('req1', undefined, 'Start');
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 8), text: 'edit1' }]));
        timeline.createCheckpoint('req1', 'stop1', 'Edit 1');
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 6), text: 'edit2' }]));
        timeline.createCheckpoint('req1', 'stop2', 'Edit 2');
        const stateWithTwoEdits = timeline.getStateForPersistence();
        assert.strictEqual(stateWithTwoEdits.operations.length, 2);
        // Undo to stop1
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'stop1'));
        // Record new operation - this should truncate the second edit
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 6), text: 'edit3' }]));
        const stateAfterNewEdit = timeline.getStateForPersistence();
        assert.strictEqual(stateAfterNewEdit.operations.length, 2);
        assert.strictEqual(stateAfterNewEdit.operations[1].type, FileOperationType.TextEdit);
        // The second operation should be the new edit3, not edit2
    });
    test('redo after recording new operation should work', async function () {
        const uri = URI.parse('file:///test.txt');
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'initial',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.createCheckpoint('req1', undefined, 'Start');
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 8), text: 'edit1' }]));
        timeline.createCheckpoint('req1', 'stop1', 'Edit 1');
        // Undo
        await timeline.undoToLastCheckpoint();
        assert.strictEqual(timeline.canRedo.get(), true);
        // Redo
        await timeline.redoToNextCheckpoint();
        // After redo, canRedo depends on whether we're at the latest epoch
        // Since we created a checkpoint after the operation, currentEpoch is ahead
        // of the checkpoint epoch, so canRedo may still be true
        assert.strictEqual(timeline.canUndo.get(), true);
    });
    test('redo when there is no checkpoint after operation', async function () {
        const uri = URI.parse('file:///test.txt');
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'initial',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.createCheckpoint('req1', undefined, 'Start');
        // Record operation but don't create checkpoint after it
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 8), text: 'edit1' }]));
        // Undo to start
        const startCheckpoint = timeline.getCheckpointIdForRequest('req1', undefined);
        await timeline.navigateToCheckpoint(startCheckpoint);
        // Should be able to redo even without a checkpoint after the operation
        assert.strictEqual(timeline.canRedo.get(), true);
        await timeline.redoToNextCheckpoint();
        // After redo, we should be at the operation's epoch + 1
        const state = timeline.getStateForPersistence();
        assert.ok(state.currentEpoch > 1);
    });
    test('getContentAtStop returns empty for non-existent file', async function () {
        const uri = URI.parse('file:///nonexistent.txt');
        const content = await timeline.getContentAtStop('req1', uri, 'stop1');
        assert.strictEqual(content, '');
    });
    test('getContentAtStop with epoch-based stopId', async function () {
        const uri = URI.parse('file:///test.txt');
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'initial',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        const editEpoch = timeline.incrementEpoch();
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', editEpoch, [{ range: new Range(1, 1, 1, 8), text: 'modified' }]));
        // Use epoch-based stop ID
        const content = await timeline.getContentAtStop('req1', uri, `__epoch_${editEpoch + 1}`);
        assert.ok(content);
        assert.strictEqual(content, 'modified');
    });
    test('hasFileBaseline correctly reports baseline existence', function () {
        const uri = URI.parse('file:///test.txt');
        assert.strictEqual(timeline.hasFileBaseline(uri, 'req1'), false);
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'initial',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        assert.strictEqual(timeline.hasFileBaseline(uri, 'req1'), true);
        assert.strictEqual(timeline.hasFileBaseline(uri, 'req2'), false);
    });
    test('multiple text edits to same file are properly replayed', async function () {
        const uri = URI.parse('file:///test.txt');
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'line1\nline2\nline3',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.createCheckpoint('req1', undefined, 'Start');
        // First edit - uppercase line 1
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 6), text: 'LINE1' }]));
        // Second edit - uppercase line 2
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(2, 1, 2, 6), text: 'LINE2' }]));
        // Third edit - uppercase line 3
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(3, 1, 3, 6), text: 'LINE3' }]));
        timeline.createCheckpoint('req1', 'all-edits', 'All edits');
        // Navigate to see all edits applied
        const initialCheckpoint = timeline.getStateForPersistence().checkpoints[0];
        await timeline.navigateToCheckpoint(initialCheckpoint.checkpointId);
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'all-edits'));
        assert.strictEqual(fileContents.get(uri), 'LINE1\nLINE2\nLINE3');
    });
    test('checkpoint with same requestId and undoStopId is not duplicated', function () {
        timeline.createCheckpoint('req1', 'stop1', 'First');
        timeline.createCheckpoint('req1', 'stop1', 'Second'); // Should be ignored
        const checkpoints = timeline.getStateForPersistence().checkpoints;
        const req1Stop1Checkpoints = checkpoints.filter(c => c.requestId === 'req1' && c.undoStopId === 'stop1');
        assert.strictEqual(req1Stop1Checkpoints.length, 1);
        assert.strictEqual(req1Stop1Checkpoints[0].label, 'First');
    });
    test('finding baseline after file rename operation', async function () {
        const oldUri = URI.parse('file:///old.txt');
        const newUri = URI.parse('file:///new.txt');
        // Create baseline for old URI
        timeline.recordFileBaseline(upcastPartial({
            uri: oldUri,
            requestId: 'req1',
            content: 'initial content',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        // Edit the file before rename (replace entire content)
        timeline.recordFileOperation(createTextEditOperation(oldUri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 16), text: 'modified content' }]));
        // Rename operation
        timeline.recordFileOperation(createFileRenameOperation(oldUri, newUri, 'req1', timeline.incrementEpoch()));
        timeline.createCheckpoint('req1', 'renamed', 'After rename');
        // Get content at the renamed URI - should find the baseline through rename chain
        const content = await timeline.getContentAtStop('req1', newUri, 'renamed');
        assert.strictEqual(content, 'modified content');
    });
    test('baseline lookup across different request IDs', async function () {
        const uri = URI.parse('file:///test.txt');
        // First request baseline
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'req1 content',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 13), text: 'req1 modified' }]));
        // Second request baseline
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req2',
            content: 'req2 content',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.recordFileOperation(createTextEditOperation(uri, 'req2', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 13), text: 'req2 modified' }]));
        timeline.createCheckpoint('req2', 'stop1', 'Req2 checkpoint');
        // Getting content should use req2 baseline
        const content = await timeline.getContentAtStop('req2', uri, 'stop1');
        assert.strictEqual(content, 'req2 modified');
    });
    test('getContentAtStop with file that does not exist in operations', async function () {
        const uri = URI.parse('file:///test.txt');
        timeline.recordFileBaseline(upcastPartial({
            uri,
            requestId: 'req1',
            content: 'content',
            epoch: timeline.incrementEpoch(),
            telemetryInfo: DEFAULT_TELEMETRY_INFO
        }));
        timeline.createCheckpoint('req1', 'stop1', 'Checkpoint');
        // Try to get content for a different URI that doesn't have any operations
        const differentUri = URI.parse('file:///different.txt');
        const content = await timeline.getContentAtStop('req1', differentUri, 'stop1');
        assert.strictEqual(content, '');
    });
    test('undoToLastCheckpoint when canUndo is false does nothing', async function () {
        // At initial state, canUndo should be false
        assert.strictEqual(timeline.canUndo.get(), false);
        const stateBefore = timeline.getStateForPersistence();
        await timeline.undoToLastCheckpoint();
        const stateAfter = timeline.getStateForPersistence();
        // Should not have changed
        assert.strictEqual(stateBefore.currentEpoch, stateAfter.currentEpoch);
    });
    test('redoToNextCheckpoint when canRedo is false does nothing', async function () {
        // At initial state with no future operations, canRedo should be false
        assert.strictEqual(timeline.canRedo.get(), false);
        const stateBefore = timeline.getStateForPersistence();
        await timeline.redoToNextCheckpoint();
        const stateAfter = timeline.getStateForPersistence();
        // Should not have changed
        assert.strictEqual(stateBefore.currentEpoch, stateAfter.currentEpoch);
    });
    test('orphaned operations and checkpoints are removed after undo and new changes', async function () {
        const uri = URI.parse('file:///test.txt');
        // Create the file first
        const createEpoch = timeline.incrementEpoch();
        timeline.recordFileOperation(createFileCreateOperation(uri, 'req1', createEpoch, 'initial content'));
        timeline.createCheckpoint('req1', undefined, 'Start req1');
        // First set of changes
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 16), text: 'first edit' }]));
        timeline.createCheckpoint('req1', 'stop1', 'First Edit');
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 11), text: 'second edit' }]));
        timeline.createCheckpoint('req1', 'stop2', 'Second Edit');
        // Verify we have 3 operations (create + 2 edits) and 4 checkpoints (initial, start, stop1, stop2)
        let state = timeline.getStateForPersistence();
        assert.strictEqual(state.operations.length, 3);
        assert.strictEqual(state.checkpoints.length, 4);
        // Undo to stop1 (before second edit)
        await timeline.navigateToCheckpoint(timeline.getCheckpointIdForRequest('req1', 'stop1'));
        // Record a new operation - this should truncate the "second edit" operation
        // and remove the stop2 checkpoint
        timeline.recordFileOperation(createTextEditOperation(uri, 'req1', timeline.incrementEpoch(), [{ range: new Range(1, 1, 1, 11), text: 'replacement edit' }]));
        timeline.createCheckpoint('req1', 'stop2-new', 'Replacement Edit');
        // Verify the orphaned operation and checkpoint are gone
        state = timeline.getStateForPersistence();
        assert.strictEqual(state.operations.length, 3, 'Should still have 3 operations (create + first + replacement)');
        assert.strictEqual(state.checkpoints.length, 4, 'Should have 4 checkpoints (initial, start, stop1, stop2-new)');
        // Verify the third operation is the replacement, not the original second edit
        const thirdOp = state.operations[2];
        assert.strictEqual(thirdOp.type, FileOperationType.TextEdit);
        if (thirdOp.type === FileOperationType.TextEdit) {
            assert.strictEqual(thirdOp.edits[0].text, 'replacement edit');
        }
        // Verify the stop2-new checkpoint exists, not stop2
        const stop2NewCheckpoint = timeline.getCheckpointIdForRequest('req1', 'stop2-new');
        const stop2OldCheckpoint = timeline.getCheckpointIdForRequest('req1', 'stop2');
        assert.ok(stop2NewCheckpoint, 'New checkpoint should exist');
        assert.strictEqual(stop2OldCheckpoint, undefined, 'Old orphaned checkpoint should be removed');
        // Now navigate through the entire timeline to verify consistency
        const initialCheckpoint = state.checkpoints[0];
        const startCheckpoint = timeline.getCheckpointIdForRequest('req1', undefined);
        const stop1Checkpoint = timeline.getCheckpointIdForRequest('req1', 'stop1');
        const stop2NewCheckpointId = timeline.getCheckpointIdForRequest('req1', 'stop2-new');
        // Navigate to initial to clear everything
        await timeline.navigateToCheckpoint(initialCheckpoint.checkpointId);
        assert.strictEqual(fileContents.has(uri), false);
        // Navigate to start - file should be created
        await timeline.navigateToCheckpoint(startCheckpoint);
        assert.strictEqual(fileContents.get(uri), 'initial content');
        // Navigate to stop1 - first edit should be applied
        await timeline.navigateToCheckpoint(stop1Checkpoint);
        assert.strictEqual(fileContents.get(uri), 'first edit');
        // Navigate to stop2-new - replacement edit should be applied, NOT the orphaned "second edit"
        await timeline.navigateToCheckpoint(stop2NewCheckpointId);
        assert.strictEqual(fileContents.get(uri), 'replacement edit');
        // Navigate back to start
        await timeline.navigateToCheckpoint(startCheckpoint);
        assert.strictEqual(fileContents.get(uri), 'initial content');
        // Navigate forward through all checkpoints again to ensure redo works correctly
        await timeline.navigateToCheckpoint(stop1Checkpoint);
        assert.strictEqual(fileContents.get(uri), 'first edit');
        await timeline.navigateToCheckpoint(stop2NewCheckpointId);
        assert.strictEqual(fileContents.get(uri), 'replacement edit', 'Orphaned edit should never reappear');
        // Go back to initial and forward again to thoroughly test
        await timeline.navigateToCheckpoint(initialCheckpoint.checkpointId);
        await timeline.navigateToCheckpoint(stop2NewCheckpointId);
        assert.strictEqual(fileContents.get(uri), 'replacement edit', 'Content should still be correct after full timeline traversal');
    });
});
// Mock notebook service for tests that don't need notebook functionality
class TestNotebookService {
    getNotebookTextModel() { return undefined; }
    hasSupportedNotebooks() { return false; }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdDaGVja3BvaW50VGltZWxpbmUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvYnJvd3Nlci9jaGF0RWRpdGluZ0NoZWNrcG9pbnRUaW1lbGluZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDN0YsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDdEcsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDL0UsT0FBTyxFQUFFLGlDQUFpQyxFQUFrQyxNQUFNLGdFQUFnRSxDQUFDO0FBQ25KLE9BQU8sRUFBaUIsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUd0RyxLQUFLLENBQUMsK0JBQStCLEVBQUU7SUFFdEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxlQUFlLEVB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