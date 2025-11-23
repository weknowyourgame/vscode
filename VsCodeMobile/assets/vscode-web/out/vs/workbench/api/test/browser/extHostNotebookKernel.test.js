/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Barrier } from '../../../../base/common/async.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { NullLogService } from '../../../../platform/log/common/log.js';
import { MainContext } from '../../common/extHost.protocol.js';
import { ExtHostCommands } from '../../common/extHostCommands.js';
import { ExtHostDocuments } from '../../common/extHostDocuments.js';
import { ExtHostDocumentsAndEditors } from '../../common/extHostDocumentsAndEditors.js';
import { ExtHostNotebookController } from '../../common/extHostNotebook.js';
import { ExtHostNotebookDocuments } from '../../common/extHostNotebookDocuments.js';
import { ExtHostNotebookKernels } from '../../common/extHostNotebookKernels.js';
import { NotebookCellOutput, NotebookCellOutputItem } from '../../common/extHostTypes.js';
import { CellKind, CellUri, NotebookCellsChangeType } from '../../../contrib/notebook/common/notebookCommon.js';
import { CellExecutionUpdateType } from '../../../contrib/notebook/common/notebookExecutionService.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { SerializableObjectWithBuffers } from '../../../services/extensions/common/proxyIdentifier.js';
import { TestRPCProtocol } from '../common/testRPCProtocol.js';
import { mock } from '../../../test/common/workbenchTestServices.js';
import { ExtHostConsumerFileSystem } from '../../common/extHostFileSystemConsumer.js';
import { ExtHostFileSystemInfo } from '../../common/extHostFileSystemInfo.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ExtHostSearch } from '../../common/extHostSearch.js';
import { URITransformerService } from '../../common/extHostUriTransformerService.js';
suite('NotebookKernel', function () {
    let rpcProtocol;
    let extHostNotebookKernels;
    let notebook;
    let extHostDocumentsAndEditors;
    let extHostDocuments;
    let extHostNotebooks;
    let extHostNotebookDocuments;
    let extHostCommands;
    let extHostConsumerFileSystem;
    let extHostSearch;
    const notebookUri = URI.parse('test:///notebook.file');
    const kernelData = new Map();
    const disposables = new DisposableStore();
    const cellExecuteCreate = [];
    const cellExecuteUpdates = [];
    const cellExecuteComplete = [];
    teardown(function () {
        disposables.clear();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    setup(async function () {
        cellExecuteCreate.length = 0;
        cellExecuteUpdates.length = 0;
        cellExecuteComplete.length = 0;
        kernelData.clear();
        rpcProtocol = new TestRPCProtocol();
        rpcProtocol.set(MainContext.MainThreadCommands, new class extends mock() {
            $registerCommand() { }
        });
        rpcProtocol.set(MainContext.MainThreadNotebookKernels, new class extends mock() {
            async $addKernel(handle, data) {
                kernelData.set(handle, data);
            }
            $removeKernel(handle) {
                kernelData.delete(handle);
            }
            $updateKernel(handle, data) {
                assert.strictEqual(kernelData.has(handle), true);
                kernelData.set(handle, { ...kernelData.get(handle), ...data, });
            }
            $createExecution(handle, controllerId, uri, cellHandle) {
                cellExecuteCreate.push({ notebook: uri, cell: cellHandle });
            }
            $updateExecution(handle, data) {
                cellExecuteUpdates.push(...data.value);
            }
            $completeExecution(handle, data) {
                cellExecuteComplete.push(data.value);
            }
        });
        rpcProtocol.set(MainContext.MainThreadNotebookDocuments, new class extends mock() {
        });
        rpcProtocol.set(MainContext.MainThreadNotebook, new class extends mock() {
            async $registerNotebookSerializer() { }
            async $unregisterNotebookSerializer() { }
        });
        extHostDocumentsAndEditors = new ExtHostDocumentsAndEditors(rpcProtocol, new NullLogService());
        extHostDocuments = disposables.add(new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors));
        extHostCommands = new ExtHostCommands(rpcProtocol, new NullLogService(), new class extends mock() {
            onExtensionError() {
                return true;
            }
        });
        extHostConsumerFileSystem = new ExtHostConsumerFileSystem(rpcProtocol, new ExtHostFileSystemInfo());
        extHostSearch = new ExtHostSearch(rpcProtocol, new URITransformerService(null), new NullLogService());
        extHostNotebooks = new ExtHostNotebookController(rpcProtocol, extHostCommands, extHostDocumentsAndEditors, extHostDocuments, extHostConsumerFileSystem, extHostSearch, new NullLogService());
        extHostNotebookDocuments = new ExtHostNotebookDocuments(extHostNotebooks);
        extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({
            addedDocuments: [{
                    uri: notebookUri,
                    viewType: 'test',
                    versionId: 0,
                    cells: [{
                            handle: 0,
                            uri: CellUri.generate(notebookUri, 0),
                            source: ['### Heading'],
                            eol: '\n',
                            language: 'markdown',
                            cellKind: CellKind.Markup,
                            outputs: [],
                        }, {
                            handle: 1,
                            uri: CellUri.generate(notebookUri, 1),
                            source: ['console.log("aaa")', 'console.log("bbb")'],
                            eol: '\n',
                            language: 'javascript',
                            cellKind: CellKind.Code,
                            outputs: [],
                        }],
                }],
            addedEditors: [{
                    documentUri: notebookUri,
                    id: '_notebook_editor_0',
                    selections: [{ start: 0, end: 1 }],
                    visibleRanges: [],
                    viewType: 'test',
                }]
        }));
        extHostNotebooks.$acceptDocumentAndEditorsDelta(new SerializableObjectWithBuffers({ newActiveEditor: '_notebook_editor_0' }));
        notebook = extHostNotebooks.notebookDocuments[0];
        disposables.add(notebook);
        disposables.add(extHostDocuments);
        extHostNotebookKernels = new ExtHostNotebookKernels(rpcProtocol, new class extends mock() {
        }, extHostNotebooks, extHostCommands, new NullLogService());
    });
    test('create/dispose kernel', async function () {
        const kernel = extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo');
        // eslint-disable-next-line local/code-no-any-casts
        assert.throws(() => kernel.id = 'dd');
        // eslint-disable-next-line local/code-no-any-casts
        assert.throws(() => kernel.notebookType = 'dd');
        assert.ok(kernel);
        assert.strictEqual(kernel.id, 'foo');
        assert.strictEqual(kernel.label, 'Foo');
        assert.strictEqual(kernel.notebookType, '*');
        await rpcProtocol.sync();
        assert.strictEqual(kernelData.size, 1);
        const [first] = kernelData.values();
        assert.strictEqual(first.id, 'nullExtensionDescription/foo');
        assert.strictEqual(ExtensionIdentifier.equals(first.extensionId, nullExtensionDescription.identifier), true);
        assert.strictEqual(first.label, 'Foo');
        assert.strictEqual(first.notebookType, '*');
        kernel.dispose();
        await rpcProtocol.sync();
        assert.strictEqual(kernelData.size, 0);
    });
    test('update kernel', async function () {
        const kernel = disposables.add(extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo'));
        await rpcProtocol.sync();
        assert.ok(kernel);
        let [first] = kernelData.values();
        assert.strictEqual(first.id, 'nullExtensionDescription/foo');
        assert.strictEqual(first.label, 'Foo');
        kernel.label = 'Far';
        assert.strictEqual(kernel.label, 'Far');
        await rpcProtocol.sync();
        [first] = kernelData.values();
        assert.strictEqual(first.id, 'nullExtensionDescription/foo');
        assert.strictEqual(first.label, 'Far');
    });
    test('execute - simple createNotebookCellExecution', function () {
        const kernel = disposables.add(extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo'));
        extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);
        const cell1 = notebook.apiNotebook.cellAt(0);
        const task = kernel.createNotebookCellExecution(cell1);
        task.start();
        task.end(undefined);
    });
    test('createNotebookCellExecution, must be selected/associated', function () {
        const kernel = disposables.add(extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo'));
        assert.throws(() => {
            kernel.createNotebookCellExecution(notebook.apiNotebook.cellAt(0));
        });
        extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);
        const execution = kernel.createNotebookCellExecution(notebook.apiNotebook.cellAt(0));
        execution.end(true);
    });
    test('createNotebookCellExecution, cell must be alive', function () {
        const kernel = disposables.add(extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo'));
        const cell1 = notebook.apiNotebook.cellAt(0);
        extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);
        extHostNotebookDocuments.$acceptModelChanged(notebook.uri, new SerializableObjectWithBuffers({
            versionId: 12,
            rawEvents: [{
                    kind: NotebookCellsChangeType.ModelChange,
                    changes: [[0, notebook.apiNotebook.cellCount, []]]
                }]
        }), true);
        assert.strictEqual(cell1.index, -1);
        assert.throws(() => {
            kernel.createNotebookCellExecution(cell1);
        });
    });
    test('interrupt handler, cancellation', async function () {
        let interruptCallCount = 0;
        let tokenCancelCount = 0;
        const kernel = disposables.add(extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo'));
        kernel.interruptHandler = () => { interruptCallCount += 1; };
        extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);
        const cell1 = notebook.apiNotebook.cellAt(0);
        const task = kernel.createNotebookCellExecution(cell1);
        disposables.add(task.token.onCancellationRequested(() => tokenCancelCount += 1));
        await extHostNotebookKernels.$cancelCells(0, notebook.uri, [0]);
        assert.strictEqual(interruptCallCount, 1);
        assert.strictEqual(tokenCancelCount, 0);
        await extHostNotebookKernels.$cancelCells(0, notebook.uri, [0]);
        assert.strictEqual(interruptCallCount, 2);
        assert.strictEqual(tokenCancelCount, 0);
        // should cancelling the cells end the execution task?
        task.end(false);
    });
    test('set outputs on cancel', async function () {
        const kernel = disposables.add(extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo'));
        extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);
        const cell1 = notebook.apiNotebook.cellAt(0);
        const task = kernel.createNotebookCellExecution(cell1);
        task.start();
        const b = new Barrier();
        disposables.add(task.token.onCancellationRequested(async () => {
            await task.replaceOutput(new NotebookCellOutput([NotebookCellOutputItem.text('canceled')]));
            task.end(true);
            b.open(); // use barrier to signal that cancellation has happened
        }));
        cellExecuteUpdates.length = 0;
        await extHostNotebookKernels.$cancelCells(0, notebook.uri, [0]);
        await b.wait();
        assert.strictEqual(cellExecuteUpdates.length > 0, true);
        let found = false;
        for (const edit of cellExecuteUpdates) {
            if (edit.editType === CellExecutionUpdateType.Output) {
                assert.strictEqual(edit.append, false);
                assert.strictEqual(edit.outputs.length, 1);
                assert.strictEqual(edit.outputs[0].items.length, 1);
                assert.deepStrictEqual(Array.from(edit.outputs[0].items[0].valueBytes.buffer), Array.from(new TextEncoder().encode('canceled')));
                found = true;
            }
        }
        assert.ok(found);
    });
    test('set outputs on interrupt', async function () {
        const kernel = extHostNotebookKernels.createNotebookController(nullExtensionDescription, 'foo', '*', 'Foo');
        extHostNotebookKernels.$acceptNotebookAssociation(0, notebook.uri, true);
        const cell1 = notebook.apiNotebook.cellAt(0);
        const task = kernel.createNotebookCellExecution(cell1);
        task.start();
        kernel.interruptHandler = async (_notebook) => {
            assert.ok(notebook.apiNotebook === _notebook);
            await task.replaceOutput(new NotebookCellOutput([NotebookCellOutputItem.text('interrupted')]));
            task.end(true);
        };
        cellExecuteUpdates.length = 0;
        await extHostNotebookKernels.$cancelCells(0, notebook.uri, [0]);
        assert.strictEqual(cellExecuteUpdates.length > 0, true);
        let found = false;
        for (const edit of cellExecuteUpdates) {
            if (edit.editType === CellExecutionUpdateType.Output) {
                assert.strictEqual(edit.append, false);
                assert.strictEqual(edit.outputs.length, 1);
                assert.strictEqual(edit.outputs[0].items.length, 1);
                assert.deepStrictEqual(Array.from(edit.outputs[0].items[0].valueBytes.buffer), Array.from(new TextEncoder().encode('interrupted')));
                found = true;
            }
        }
        assert.ok(found);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdE5vdGVib29rS2VybmVsLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS90ZXN0L2Jyb3dzZXIvZXh0SG9zdE5vdGVib29rS2VybmVsLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdkUsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMzRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUF5RSxXQUFXLEVBQXNILE1BQU0sa0NBQWtDLENBQUM7QUFDMVAsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRXhGLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRTVFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQzFGLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDaEgs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