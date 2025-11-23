/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../../base/common/map.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IMarkerService } from '../../../../../../platform/markers/common/markers.js';
import { IChatAgentService } from '../../../../chat/common/chatAgents.js';
import { CellDiagnostics } from '../../../browser/contrib/cellDiagnostics/cellDiagnosticEditorContrib.js';
import { CellKind, NotebookSetting } from '../../../common/notebookCommon.js';
import { INotebookExecutionStateService, NotebookExecutionType } from '../../../common/notebookExecutionStateService.js';
import { setupInstantiationService, TestNotebookExecutionStateService, withTestNotebook } from '../testNotebookEditor.js';
import { nullExtensionDescription } from '../../../../../services/extensions/common/extensions.js';
import { ChatAgentLocation, ChatModeKind } from '../../../../chat/common/constants.js';
suite('notebookCellDiagnostics', () => {
    let instantiationService;
    let disposables;
    let testExecutionService;
    let markerService;
    teardown(() => {
        disposables.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    class TestExecutionService extends TestNotebookExecutionStateService {
        constructor() {
            super(...arguments);
            this._onDidChangeExecution = new Emitter();
            this.onDidChangeExecution = this._onDidChangeExecution.event;
        }
        fireExecutionChanged(notebook, cellHandle, changed) {
            this._onDidChangeExecution.fire({
                type: NotebookExecutionType.cell,
                cellHandle,
                notebook,
                affectsNotebook: () => true,
                affectsCell: () => true,
                changed: changed
            });
        }
    }
    setup(function () {
        disposables = new DisposableStore();
        instantiationService = setupInstantiationService(disposables);
        testExecutionService = new TestExecutionService();
        instantiationService.stub(INotebookExecutionStateService, testExecutionService);
        const agentData = {
            extensionId: nullExtensionDescription.identifier,
            extensionVersion: undefined,
            extensionDisplayName: '',
            extensionPublisherId: '',
            name: 'testEditorAgent',
            isDefault: true,
            locations: [ChatAgentLocation.Notebook],
            modes: [ChatModeKind.Ask],
            metadata: {},
            slashCommands: [],
            disambiguation: [],
        };
        const chatAgentService = new class extends mock() {
            constructor() {
                super(...arguments);
                this.onDidChangeAgents = Event.None;
            }
            getAgents() {
                return [{
                        id: 'testEditorAgent',
                        ...agentData
                    }];
            }
        };
        instantiationService.stub(IChatAgentService, chatAgentService);
        markerService = new class extends mock() {
            constructor() {
                super(...arguments);
                this._onMarkersUpdated = new Emitter();
                this.onMarkersUpdated = this._onMarkersUpdated.event;
                this.markers = new ResourceMap();
            }
            changeOne(owner, resource, markers) {
                this.markers.set(resource, markers);
                this._onMarkersUpdated.fire();
            }
        };
        instantiationService.stub(IMarkerService, markerService);
        const config = instantiationService.get(IConfigurationService);
        config.setUserConfiguration(NotebookSetting.cellFailureDiagnostics, true);
    });
    test('diagnostic is added for cell execution failure', async function () {
        await withTestNotebook([
            ['print(x)', 'python', CellKind.Code, [], {}]
        ], async (editor, viewModel, store, accessor) => {
            const cell = viewModel.viewCells[0];
            disposables.add(instantiationService.createInstance(CellDiagnostics, editor));
            cell.model.internalMetadata.lastRunSuccess = false;
            cell.model.internalMetadata.error = {
                name: 'error',
                message: 'something bad happened',
                stack: 'line 1 : print(x)',
                uri: cell.uri,
                location: { startColumn: 1, endColumn: 5, startLineNumber: 1, endLineNumber: 1 }
            };
            testExecutionService.fireExecutionChanged(editor.textModel.uri, cell.handle);
            await new Promise(resolve => Event.once(markerService.onMarkersUpdated)(resolve));
            assert.strictEqual(cell?.executionErrorDiagnostic.get()?.message, 'something bad happened');
            assert.equal(markerService.markers.get(cell.uri)?.length, 1);
        }, instantiationService);
    });
    test('diagnostics are cleared only for cell with new execution', async function () {
        await withTestNotebook([
            ['print(x)', 'python', CellKind.Code, [], {}],
            ['print(y)', 'python', CellKind.Code, [], {}]
        ], async (editor, viewModel, store, accessor) => {
            const cell = viewModel.viewCells[0];
            const cell2 = viewModel.viewCells[1];
            disposables.add(instantiationService.createInstance(CellDiagnostics, editor));
            cell.model.internalMetadata.lastRunSuccess = false;
            cell.model.internalMetadata.error = {
                name: 'error',
                message: 'something bad happened',
                stack: 'line 1 : print(x)',
                uri: cell.uri,
                location: { startColumn: 1, endColumn: 5, startLineNumber: 1, endLineNumber: 1 }
            };
            cell2.model.internalMetadata.lastRunSuccess = false;
            cell2.model.internalMetadata.error = {
                name: 'error',
                message: 'another bad thing happened',
                stack: 'line 1 : print(y)',
                uri: cell.uri,
                location: { startColumn: 1, endColumn: 5, startLineNumber: 1, endLineNumber: 1 }
            };
            testExecutionService.fireExecutionChanged(editor.textModel.uri, cell.handle);
            testExecutionService.fireExecutionChanged(editor.textModel.uri, cell2.handle);
            await new Promise(resolve => Event.once(markerService.onMarkersUpdated)(resolve));
            const clearMarkers = new Promise(resolve => Event.once(markerService.onMarkersUpdated)(resolve));
            // on NotebookCellExecution value will make it look like its currently running
            testExecutionService.fireExecutionChanged(editor.textModel.uri, cell.handle, {});
            await clearMarkers;
            assert.strictEqual(cell?.executionErrorDiagnostic.get(), undefined);
            assert.strictEqual(cell2?.executionErrorDiagnostic.get()?.message, 'another bad thing happened', 'cell that was not executed should still have an error');
            assert.equal(markerService.markers.get(cell.uri)?.length, 0);
            assert.equal(markerService.markers.get(cell2.uri)?.length, 1);
        }, instantiationService);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tDZWxsRGlhZ25vc3RpY3MudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvY29udHJpYi9ub3RlYm9va0NlbGxEaWFnbm9zdGljcy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFbkUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBR3pHLE9BQU8sRUFBZSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNuRyxPQUFPLEVBQThCLGlCQUFpQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDdEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlFQUF5RSxDQUFDO0FBRTFHLE9BQU8sRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxFQUF3Riw4QkFBOEIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQy9NLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxpQ0FBaUMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzFILE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ25H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