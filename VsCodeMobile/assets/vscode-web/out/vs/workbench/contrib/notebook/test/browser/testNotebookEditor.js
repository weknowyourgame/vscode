/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as DOM from '../../../../../base/browser/dom.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { NotImplementedError } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { Mimes } from '../../../../../base/common/mime.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { ILanguageConfigurationService } from '../../../../../editor/common/languages/languageConfigurationRegistry.js';
import { LanguageService } from '../../../../../editor/common/services/languageService.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ModelService } from '../../../../../editor/common/services/modelService.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { TestLanguageConfigurationService } from '../../../../../editor/test/common/modes/testLanguageConfigurationService.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { MockKeybindingService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { IListService, ListService } from '../../../../../platform/list/browser/listService.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { IUndoRedoService } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { UndoRedoService } from '../../../../../platform/undoRedo/common/undoRedoService.js';
import { IWorkspaceTrustRequestService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { EditorModel } from '../../../../common/editor/editorModel.js';
import { CellFocusMode } from '../../browser/notebookBrowser.js';
import { NotebookCellStatusBarService } from '../../browser/services/notebookCellStatusBarServiceImpl.js';
import { ListViewInfoAccessor, NotebookCellList } from '../../browser/view/notebookCellList.js';
import { NotebookEventDispatcher } from '../../browser/viewModel/eventDispatcher.js';
import { NotebookViewModel } from '../../browser/viewModel/notebookViewModelImpl.js';
import { ViewContext } from '../../browser/viewModel/viewContext.js';
import { NotebookCellTextModel } from '../../common/model/notebookCellTextModel.js';
import { NotebookTextModel } from '../../common/model/notebookTextModel.js';
import { INotebookCellStatusBarService } from '../../common/notebookCellStatusBarService.js';
import { CellUri, NotebookCellExecutionState, SelectionStateType } from '../../common/notebookCommon.js';
import { INotebookExecutionStateService } from '../../common/notebookExecutionStateService.js';
import { NotebookOptions } from '../../browser/notebookOptions.js';
import { TextModelResolverService } from '../../../../services/textmodelResolver/common/textModelResolverService.js';
import { TestLayoutService } from '../../../../test/browser/workbenchTestServices.js';
import { TestStorageService, TestTextResourcePropertiesService, TestWorkspaceTrustRequestService } from '../../../../test/common/workbenchTestServices.js';
import { FontInfo } from '../../../../../editor/common/config/fontInfo.js';
import { EditorFontLigatures, EditorFontVariations } from '../../../../../editor/common/config/editorOptions.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { TestCodeEditorService } from '../../../../../editor/test/browser/editorTestServices.js';
import { INotebookCellOutlineDataSourceFactory, NotebookCellOutlineDataSourceFactory } from '../../browser/viewModel/notebookOutlineDataSourceFactory.js';
import { ILanguageDetectionService } from '../../../../services/languageDetection/common/languageDetectionWorkerService.js';
import { INotebookOutlineEntryFactory, NotebookOutlineEntryFactory } from '../../browser/viewModel/notebookOutlineEntryFactory.js';
import { IOutlineService } from '../../../../services/outline/browser/outline.js';
import { ITextResourcePropertiesService } from '../../../../../editor/common/services/textResourceConfiguration.js';
import { INotebookLoggingService } from '../../common/notebookLoggingService.js';
class NullNotebookLoggingService {
    info(category, output) { }
    warn(category, output) { }
    error(category, output) { }
    debug(category, output) { }
    trace(category, message) { }
}
export class TestCell extends NotebookCellTextModel {
    constructor(viewType, handle, source, language, cellKind, outputs, languageService) {
        super(CellUri.generate(URI.parse('test:///fake/notebook'), handle), handle, {
            source,
            language,
            mime: Mimes.text,
            cellKind,
            outputs,
            metadata: undefined,
            internalMetadata: undefined,
            collapseState: undefined
        }, { transientCellMetadata: {}, transientDocumentMetadata: {}, transientOutputs: false, cellContentMetadata: {} }, languageService, 1 /* DefaultEndOfLine.LF */, undefined, // defaultCollapseConfig
        undefined, // languageDetectionService
        new NullNotebookLoggingService());
        this.viewType = viewType;
        this.source = source;
    }
}
export class NotebookEditorTestModel extends EditorModel {
    get viewType() {
        return this._notebook.viewType;
    }
    get resource() {
        return this._notebook.uri;
    }
    get notebook() {
        return this._notebook;
    }
    constructor(_notebook) {
        super();
        this._notebook = _notebook;
        this._dirty = false;
        this._onDidSave = this._register(new Emitter());
        this.onDidSave = this._onDidSave.event;
        this._onDidChangeDirty = this._register(new Emitter());
        this.onDidChangeDirty = this._onDidChangeDirty.event;
        this.onDidChangeOrphaned = Event.None;
        this.onDidChangeReadonly = Event.None;
        this.onDidRevertUntitled = Event.None;
        this._onDidChangeContent = this._register(new Emitter());
        this.onDidChangeContent = this._onDidChangeContent.event;
        if (_notebook && _notebook.onDidChangeContent) {
            this._register(_notebook.onDidChangeContent(() => {
                this._dirty = true;
                this._onDidChangeDirty.fire();
                this._onDidChangeContent.fire();
            }));
        }
    }
    isReadonly() {
        return false;
    }
    isOrphaned() {
        return false;
    }
    hasAssociatedFilePath() {
        return false;
    }
    isDirty() {
        return this._dirty;
    }
    get hasErrorState() {
        return false;
    }
    isModified() {
        return this._dirty;
    }
    getNotebook() {
        return this._notebook;
    }
    async load() {
        return this;
    }
    async save() {
        if (this._notebook) {
            this._dirty = false;
            this._onDidChangeDirty.fire();
            this._onDidSave.fire({});
            // todo, flush all states
            return true;
        }
        return false;
    }
    saveAs() {
        throw new NotImplementedError();
    }
    revert() {
        throw new NotImplementedError();
    }
}
export function setupInstantiationService(disposables) {
    const instantiationService = disposables.add(new TestInstantiationService());
    const testThemeService = new TestThemeService();
    instantiationService.stub(ILanguageService, disposables.add(new LanguageService()));
    instantiationService.stub(IUndoRedoService, instantiationService.createInstance(UndoRedoService));
    instantiationService.stub(IConfigurationService, new TestConfigurationService());
    instantiationService.stub(IThemeService, testThemeService);
    instantiationService.stub(ILanguageConfigurationService, disposables.add(new TestLanguageConfigurationService()));
    instantiationService.stub(ITextResourcePropertiesService, instantiationService.createInstance(TestTextResourcePropertiesService));
    instantiationService.stub(IModelService, disposables.add(instantiationService.createInstance(ModelService)));
    instantiationService.stub(ITextModelService, disposables.add(instantiationService.createInstance(TextModelResolverService)));
    instantiationService.stub(IContextKeyService, disposables.add(instantiationService.createInstance(ContextKeyService)));
    instantiationService.stub(IListService, disposables.add(instantiationService.createInstance(ListService)));
    instantiationService.stub(ILayoutService, new TestLayoutService());
    instantiationService.stub(ILogService, new NullLogService());
    instantiationService.stub(IClipboardService, TestClipboardService);
    instantiationService.stub(IStorageService, disposables.add(new TestStorageService()));
    instantiationService.stub(IWorkspaceTrustRequestService, disposables.add(new TestWorkspaceTrustRequestService(true)));
    instantiationService.stub(INotebookExecutionStateService, new TestNotebookExecutionStateService());
    instantiationService.stub(IKeybindingService, new MockKeybindingService());
    instantiationService.stub(INotebookCellStatusBarService, disposables.add(new NotebookCellStatusBarService()));
    instantiationService.stub(ICodeEditorService, disposables.add(new TestCodeEditorService(testThemeService)));
    instantiationService.stub(IOutlineService, new class extends mock() {
        registerOutlineCreator() { return { dispose() { } }; }
    });
    instantiationService.stub(INotebookCellOutlineDataSourceFactory, instantiationService.createInstance(NotebookCellOutlineDataSourceFactory));
    instantiationService.stub(INotebookOutlineEntryFactory, instantiationService.createInstance(NotebookOutlineEntryFactory));
    instantiationService.stub(INotebookLoggingService, new NullNotebookLoggingService());
    instantiationService.stub(ILanguageDetectionService, new class MockLanguageDetectionService {
        isEnabledForLanguage(languageId) {
            return false;
        }
        async detectLanguage(resource, supportedLangs) {
            return undefined;
        }
    });
    return instantiationService;
}
function _createTestNotebookEditor(instantiationService, disposables, cells) {
    const viewType = 'notebook';
    const notebook = disposables.add(instantiationService.createInstance(NotebookTextModel, viewType, URI.parse('test://test'), cells.map((cell) => {
        return {
            source: cell[0],
            mime: undefined,
            language: cell[1],
            cellKind: cell[2],
            outputs: cell[3] ?? [],
            metadata: cell[4]
        };
    }), {}, { transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {}, transientOutputs: false }));
    const model = disposables.add(new NotebookEditorTestModel(notebook));
    const notebookOptions = disposables.add(new NotebookOptions(mainWindow, false, undefined, instantiationService.get(IConfigurationService), instantiationService.get(INotebookExecutionStateService), instantiationService.get(ICodeEditorService)));
    const baseCellEditorOptions = new class extends mock() {
    };
    const viewContext = new ViewContext(notebookOptions, disposables.add(new NotebookEventDispatcher()), () => baseCellEditorOptions);
    const viewModel = disposables.add(instantiationService.createInstance(NotebookViewModel, viewType, model.notebook, viewContext, null, { isReadOnly: false }));
    const cellList = disposables.add(createNotebookCellList(instantiationService, disposables, viewContext));
    cellList.attachViewModel(viewModel);
    const listViewInfoAccessor = disposables.add(new ListViewInfoAccessor(cellList));
    let visibleRanges = [{ start: 0, end: 100 }];
    const id = Date.now().toString();
    const notebookEditor = new class extends mock() {
        constructor() {
            super(...arguments);
            this.notebookOptions = notebookOptions;
            this.onDidChangeModel = new Emitter().event;
            this.onDidChangeCellState = new Emitter().event;
            this.textModel = viewModel.notebookDocument;
            this.onDidChangeVisibleRanges = Event.None;
        }
        // eslint-disable-next-line local/code-must-use-super-dispose
        dispose() {
            viewModel.dispose();
        }
        getViewModel() {
            return viewModel;
        }
        hasModel() {
            return !!viewModel;
        }
        getLength() { return viewModel.length; }
        getFocus() { return viewModel.getFocus(); }
        getSelections() { return viewModel.getSelections(); }
        setFocus(focus) {
            viewModel.updateSelectionsState({
                kind: SelectionStateType.Index,
                focus: focus,
                selections: viewModel.getSelections()
            });
        }
        setSelections(selections) {
            viewModel.updateSelectionsState({
                kind: SelectionStateType.Index,
                focus: viewModel.getFocus(),
                selections: selections
            });
        }
        getViewIndexByModelIndex(index) { return listViewInfoAccessor.getViewIndex(viewModel.viewCells[index]); }
        getCellRangeFromViewRange(startIndex, endIndex) { return listViewInfoAccessor.getCellRangeFromViewRange(startIndex, endIndex); }
        revealCellRangeInView() { }
        async revealInView() { }
        setHiddenAreas(_ranges) {
            return cellList.setHiddenAreas(_ranges, true);
        }
        getActiveCell() {
            const elements = cellList.getFocusedElements();
            if (elements && elements.length) {
                return elements[0];
            }
            return undefined;
        }
        hasOutputTextSelection() {
            return false;
        }
        changeModelDecorations() { return null; }
        focusElement() { }
        setCellEditorSelection() { }
        async revealRangeInCenterIfOutsideViewportAsync() { }
        async layoutNotebookCell() { }
        async createOutput() { }
        async removeInset() { }
        async focusNotebookCell(cell, focusItem) {
            cell.focusMode = focusItem === 'editor' ? CellFocusMode.Editor
                : focusItem === 'output' ? CellFocusMode.Output
                    : CellFocusMode.Container;
        }
        cellAt(index) { return viewModel.cellAt(index); }
        getCellIndex(cell) { return viewModel.getCellIndex(cell); }
        getCellsInRange(range) { return viewModel.getCellsInRange(range); }
        getCellByHandle(handle) { return viewModel.getCellByHandle(handle); }
        getNextVisibleCellIndex(index) { return viewModel.getNextVisibleCellIndex(index); }
        getControl() { return this; }
        get onDidChangeSelection() { return viewModel.onDidChangeSelection; }
        get onDidChangeOptions() { return viewModel.onDidChangeOptions; }
        get onDidChangeViewCells() { return viewModel.onDidChangeViewCells; }
        async find(query, options) {
            const findMatches = viewModel.find(query, options).filter(match => match.length > 0);
            return findMatches;
        }
        deltaCellDecorations() { return []; }
        get visibleRanges() {
            return visibleRanges;
        }
        set visibleRanges(_ranges) {
            visibleRanges = _ranges;
        }
        getId() { return id; }
        setScrollTop(scrollTop) {
            cellList.scrollTop = scrollTop;
        }
        get scrollTop() {
            return cellList.scrollTop;
        }
        getLayoutInfo() {
            return {
                width: 0,
                height: 0,
                scrollHeight: cellList.getScrollHeight(),
                fontInfo: new FontInfo({
                    pixelRatio: 1,
                    fontFamily: 'mockFont',
                    fontWeight: 'normal',
                    fontSize: 14,
                    fontFeatureSettings: EditorFontLigatures.OFF,
                    fontVariationSettings: EditorFontVariations.OFF,
                    lineHeight: 19,
                    letterSpacing: 1.5,
                    isMonospace: true,
                    typicalHalfwidthCharacterWidth: 10,
                    typicalFullwidthCharacterWidth: 20,
                    canUseHalfwidthRightwardsArrow: true,
                    spaceWidth: 10,
                    middotWidth: 10,
                    wsmiddotWidth: 10,
                    maxDigitWidth: 10,
                }, true),
                stickyHeight: 0,
                listViewOffsetTop: 0,
            };
        }
    };
    return { editor: notebookEditor, viewModel };
}
export function createTestNotebookEditor(instantiationService, disposables, cells) {
    return _createTestNotebookEditor(instantiationService, disposables, cells);
}
export async function withTestNotebookDiffModel(originalCells, modifiedCells, callback) {
    const disposables = new DisposableStore();
    const instantiationService = setupInstantiationService(disposables);
    const originalNotebook = createTestNotebookEditor(instantiationService, disposables, originalCells);
    const modifiedNotebook = createTestNotebookEditor(instantiationService, disposables, modifiedCells);
    const originalResource = new class extends mock() {
        get notebook() {
            return originalNotebook.viewModel.notebookDocument;
        }
        get resource() {
            return originalNotebook.viewModel.notebookDocument.uri;
        }
    };
    const modifiedResource = new class extends mock() {
        get notebook() {
            return modifiedNotebook.viewModel.notebookDocument;
        }
        get resource() {
            return modifiedNotebook.viewModel.notebookDocument.uri;
        }
    };
    const model = new class extends mock() {
        get original() {
            return originalResource;
        }
        get modified() {
            return modifiedResource;
        }
    };
    const res = await callback(model, disposables, instantiationService);
    if (res instanceof Promise) {
        res.finally(() => {
            originalNotebook.editor.dispose();
            originalNotebook.viewModel.notebookDocument.dispose();
            originalNotebook.viewModel.dispose();
            modifiedNotebook.editor.dispose();
            modifiedNotebook.viewModel.notebookDocument.dispose();
            modifiedNotebook.viewModel.dispose();
            disposables.dispose();
        });
    }
    else {
        originalNotebook.editor.dispose();
        originalNotebook.viewModel.notebookDocument.dispose();
        originalNotebook.viewModel.dispose();
        modifiedNotebook.editor.dispose();
        modifiedNotebook.viewModel.notebookDocument.dispose();
        modifiedNotebook.viewModel.dispose();
        disposables.dispose();
    }
    return res;
}
export async function withTestNotebook(cells, callback, accessor) {
    const disposables = new DisposableStore();
    const instantiationService = accessor ?? setupInstantiationService(disposables);
    const notebookEditor = _createTestNotebookEditor(instantiationService, disposables, cells);
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
        const res = await callback(notebookEditor.editor, notebookEditor.viewModel, disposables, instantiationService);
        if (res instanceof Promise) {
            res.finally(() => {
                notebookEditor.editor.dispose();
                notebookEditor.viewModel.dispose();
                notebookEditor.editor.textModel.dispose();
                disposables.dispose();
            });
        }
        else {
            notebookEditor.editor.dispose();
            notebookEditor.viewModel.dispose();
            notebookEditor.editor.textModel.dispose();
            disposables.dispose();
        }
        return res;
    });
}
export function createNotebookCellList(instantiationService, disposables, viewContext) {
    const delegate = {
        getHeight(element) { return element.getHeight(17); },
        getTemplateId() { return 'template'; }
    };
    const baseCellRenderTemplate = new class extends mock() {
    };
    const renderer = {
        templateId: 'template',
        renderTemplate() { return baseCellRenderTemplate; },
        renderElement() { },
        disposeTemplate() { }
    };
    const notebookOptions = !!viewContext ? viewContext.notebookOptions
        : disposables.add(new NotebookOptions(mainWindow, false, undefined, instantiationService.get(IConfigurationService), instantiationService.get(INotebookExecutionStateService), instantiationService.get(ICodeEditorService)));
    const cellList = disposables.add(instantiationService.createInstance(NotebookCellList, 'NotebookCellList', DOM.$('container'), notebookOptions, delegate, [renderer], instantiationService.get(IContextKeyService), {
        supportDynamicHeights: true,
        multipleSelectionSupport: true,
    }));
    return cellList;
}
export function valueBytesFromString(value) {
    return VSBuffer.fromString(value);
}
class TestCellExecution {
    constructor(notebook, cellHandle, onComplete) {
        this.notebook = notebook;
        this.cellHandle = cellHandle;
        this.onComplete = onComplete;
        this.state = NotebookCellExecutionState.Unconfirmed;
        this.didPause = false;
        this.isPaused = false;
    }
    confirm() {
    }
    update(updates) {
    }
    complete(complete) {
        this.onComplete();
    }
}
export class TestNotebookExecutionStateService {
    constructor() {
        this._executions = new ResourceMap();
        this.onDidChangeExecution = new Emitter().event;
        this.onDidChangeLastRunFailState = new Emitter().event;
    }
    forceCancelNotebookExecutions(notebookUri) {
    }
    getCellExecutionsForNotebook(notebook) {
        return [];
    }
    getCellExecution(cellUri) {
        return this._executions.get(cellUri);
    }
    createCellExecution(notebook, cellHandle) {
        const onComplete = () => this._executions.delete(CellUri.generate(notebook, cellHandle));
        const exe = new TestCellExecution(notebook, cellHandle, onComplete);
        this._executions.set(CellUri.generate(notebook, cellHandle), exe);
        return exe;
    }
    getCellExecutionsByHandleForNotebook(notebook) {
        return;
    }
    getLastFailedCellForNotebook(notebook) {
        return;
    }
    getLastCompletedCellForNotebook(notebook) {
        return;
    }
    getExecution(notebook) {
        return;
    }
    createExecution(notebook) {
        throw new Error('Method not implemented.');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdE5vdGVib29rRWRpdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL3Rlc3QvYnJvd3Nlci90ZXN0Tm90ZWJvb2tFZGl0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQ0FBb0MsQ0FBQztBQUUxRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzVGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHlFQUF5RSxDQUFDO0FBQ3hILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUMzRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDL0UsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDBE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