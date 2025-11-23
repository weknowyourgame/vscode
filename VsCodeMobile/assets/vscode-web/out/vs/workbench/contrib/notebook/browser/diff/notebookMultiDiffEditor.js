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
var NotebookMultiTextDiffEditor_1;
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { INotebookEditorWorkerService } from '../../common/services/notebookWorkerService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { createBareFontInfoFromRawSettings } from '../../../../../editor/common/config/fontInfoFromSettings.js';
import { PixelRatio } from '../../../../../base/browser/pixelRatio.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js';
import { CellUri, NOTEBOOK_MULTI_DIFF_EDITOR_ID } from '../../common/notebookCommon.js';
import { FontMeasurements } from '../../../../../editor/browser/config/fontMeasurements.js';
import { NotebookOptions } from '../notebookOptions.js';
import { INotebookService } from '../../common/notebookService.js';
import { NotebookMultiDiffEditorWidgetInput } from './notebookMultiDiffEditorInput.js';
import { MultiDiffEditorWidget } from '../../../../../editor/browser/widget/multiDiffEditor/multiDiffEditorWidget.js';
import { ResourceLabel } from '../../../../browser/labels.js';
import { INotebookDocumentService } from '../../../../services/notebook/common/notebookDocumentService.js';
import { localize } from '../../../../../nls.js';
import { Schemas } from '../../../../../base/common/network.js';
import { getIconClassesForLanguageId } from '../../../../../editor/common/services/getIconClasses.js';
import { NotebookDiffViewModel } from './notebookDiffViewModel.js';
import { NotebookDiffEditorEventDispatcher } from './eventDispatcher.js';
import { NOTEBOOK_DIFF_CELLS_COLLAPSED, NOTEBOOK_DIFF_HAS_UNCHANGED_CELLS, NOTEBOOK_DIFF_UNCHANGED_CELLS_HIDDEN } from './notebookDiffEditorBrowser.js';
import { autorun, transaction } from '../../../../../base/common/observable.js';
import { DiffEditorHeightCalculatorService } from './editorHeightCalculator.js';
let NotebookMultiTextDiffEditor = class NotebookMultiTextDiffEditor extends EditorPane {
    static { NotebookMultiTextDiffEditor_1 = this; }
    static { this.ID = NOTEBOOK_MULTI_DIFF_EDITOR_ID; }
    get textModel() {
        return this._model?.modified.notebook;
    }
    get notebookOptions() {
        return this._notebookOptions;
    }
    constructor(group, instantiationService, themeService, _parentContextKeyService, notebookEditorWorkerService, configurationService, telemetryService, storageService, notebookService) {
        super(NotebookMultiTextDiffEditor_1.ID, group, telemetryService, themeService, storageService);
        this.instantiationService = instantiationService;
        this._parentContextKeyService = _parentContextKeyService;
        this.notebookEditorWorkerService = notebookEditorWorkerService;
        this.configurationService = configurationService;
        this.notebookService = notebookService;
        this.modelSpecificResources = this._register(new DisposableStore());
        this.ctxAllCollapsed = this._parentContextKeyService.createKey(NOTEBOOK_DIFF_CELLS_COLLAPSED.key, false);
        this.ctxHasUnchangedCells = this._parentContextKeyService.createKey(NOTEBOOK_DIFF_HAS_UNCHANGED_CELLS.key, false);
        this.ctxHiddenUnchangedCells = this._parentContextKeyService.createKey(NOTEBOOK_DIFF_UNCHANGED_CELLS_HIDDEN.key, true);
        this._notebookOptions = instantiationService.createInstance(NotebookOptions, this.window, false, undefined);
        this._register(this._notebookOptions);
    }
    get fontInfo() {
        if (!this._fontInfo) {
            this._fontInfo = this.createFontInfo();
        }
        return this._fontInfo;
    }
    layout(dimension, position) {
        this._multiDiffEditorWidget.layout(dimension);
    }
    createFontInfo() {
        const editorOptions = this.configurationService.getValue('editor');
        return FontMeasurements.readFontInfo(this.window, createBareFontInfoFromRawSettings(editorOptions, PixelRatio.getInstance(this.window).value));
    }
    createEditor(parent) {
        this._multiDiffEditorWidget = this._register(this.instantiationService.createInstance(MultiDiffEditorWidget, parent, this.instantiationService.createInstance(WorkbenchUIElementFactory)));
        this._register(this._multiDiffEditorWidget.onDidChangeActiveControl(() => {
            this._onDidChangeControl.fire();
        }));
    }
    async setInput(input, options, context, token) {
        super.setInput(input, options, context, token);
        const model = await input.resolve();
        if (this._model !== model) {
            this._detachModel();
            this._model = model;
        }
        const eventDispatcher = this.modelSpecificResources.add(new NotebookDiffEditorEventDispatcher());
        const diffEditorHeightCalculator = this.instantiationService.createInstance(DiffEditorHeightCalculatorService, this.fontInfo.lineHeight);
        this.viewModel = this.modelSpecificResources.add(new NotebookDiffViewModel(model, this.notebookEditorWorkerService, this.configurationService, eventDispatcher, this.notebookService, diffEditorHeightCalculator, undefined, true));
        await this.viewModel.computeDiff(this.modelSpecificResources.add(new CancellationTokenSource()).token);
        this.ctxHasUnchangedCells.set(this.viewModel.hasUnchangedCells);
        this.ctxHasUnchangedCells.set(this.viewModel.hasUnchangedCells);
        const widgetInput = this.modelSpecificResources.add(NotebookMultiDiffEditorWidgetInput.createInput(this.viewModel, this.instantiationService));
        this.widgetViewModel = this.modelSpecificResources.add(await widgetInput.getViewModel());
        const itemsWeHaveSeen = new WeakSet();
        this.modelSpecificResources.add(autorun(reader => {
            /** @description NotebookDiffEditor => Collapse unmodified items */
            if (!this.widgetViewModel || !this.viewModel) {
                return;
            }
            const items = this.widgetViewModel.items.read(reader);
            const diffItems = this.viewModel.value;
            if (items.length !== diffItems.length) {
                return;
            }
            // If cell has not changed, but metadata or output has changed, then collapse the cell & keep output/metadata expanded.
            // Similarly if the cell has changed, but the metadata or output has not, then expand the cell, but collapse output/metadata.
            transaction((tx) => {
                items.forEach(item => {
                    // We do not want to mess with UI state if users change it, hence no need to collapse again.
                    if (itemsWeHaveSeen.has(item)) {
                        return;
                    }
                    itemsWeHaveSeen.add(item);
                    const diffItem = diffItems.find(d => d.modifiedUri?.toString() === item.modifiedUri?.toString() && d.originalUri?.toString() === item.originalUri?.toString());
                    if (diffItem && diffItem.type === 'unchanged') {
                        item.collapsed.set(true, tx);
                    }
                });
            });
        }));
        this._multiDiffEditorWidget.setViewModel(this.widgetViewModel);
    }
    _detachModel() {
        this.viewModel = undefined;
        this.modelSpecificResources.clear();
    }
    _generateFontFamily() {
        return this.fontInfo.fontFamily ?? `"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace`;
    }
    setOptions(options) {
        super.setOptions(options);
    }
    getControl() {
        return this._multiDiffEditorWidget.getActiveControl();
    }
    focus() {
        super.focus();
        this._multiDiffEditorWidget?.getActiveControl()?.focus();
    }
    hasFocus() {
        return this._multiDiffEditorWidget?.getActiveControl()?.hasTextFocus() || super.hasFocus();
    }
    clearInput() {
        super.clearInput();
        this._multiDiffEditorWidget.setViewModel(undefined);
        this.modelSpecificResources.clear();
        this.viewModel = undefined;
        this.widgetViewModel = undefined;
    }
    expandAll() {
        if (this.widgetViewModel) {
            this.widgetViewModel.expandAll();
            this.ctxAllCollapsed.set(false);
        }
    }
    collapseAll() {
        if (this.widgetViewModel) {
            this.widgetViewModel.collapseAll();
            this.ctxAllCollapsed.set(true);
        }
    }
    hideUnchanged() {
        if (this.viewModel) {
            this.viewModel.includeUnchanged = false;
            this.ctxHiddenUnchangedCells.set(true);
        }
    }
    showUnchanged() {
        if (this.viewModel) {
            this.viewModel.includeUnchanged = true;
            this.ctxHiddenUnchangedCells.set(false);
        }
    }
    getDiffElementViewModel(uri) {
        if (uri.scheme === Schemas.vscodeNotebookCellOutput || uri.scheme === Schemas.vscodeNotebookCellOutputDiff ||
            uri.scheme === Schemas.vscodeNotebookCellMetadata || uri.scheme === Schemas.vscodeNotebookCellMetadataDiff) {
            const data = CellUri.parseCellPropertyUri(uri, uri.scheme);
            if (data) {
                uri = CellUri.generate(data.notebook, data.handle);
            }
        }
        if (uri.scheme === Schemas.vscodeNotebookMetadata) {
            return this.viewModel?.items.find(item => item.type === 'modifiedMetadata' ||
                item.type === 'unchangedMetadata');
        }
        return this.viewModel?.items.find(c => {
            switch (c.type) {
                case 'delete':
                    return c.original?.uri.toString() === uri.toString();
                case 'insert':
                    return c.modified?.uri.toString() === uri.toString();
                case 'modified':
                case 'unchanged':
                    return c.modified?.uri.toString() === uri.toString() || c.original?.uri.toString() === uri.toString();
                default:
                    return;
            }
        });
    }
};
NotebookMultiTextDiffEditor = NotebookMultiTextDiffEditor_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IThemeService),
    __param(3, IContextKeyService),
    __param(4, INotebookEditorWorkerService),
    __param(5, IConfigurationService),
    __param(6, ITelemetryService),
    __param(7, IStorageService),
    __param(8, INotebookService)
], NotebookMultiTextDiffEditor);
export { NotebookMultiTextDiffEditor };
let WorkbenchUIElementFactory = class WorkbenchUIElementFactory {
    constructor(_instantiationService, notebookDocumentService, notebookService) {
        this._instantiationService = _instantiationService;
        this.notebookDocumentService = notebookDocumentService;
        this.notebookService = notebookService;
    }
    createResourceLabel(element) {
        const label = this._instantiationService.createInstance(ResourceLabel, element, {});
        const that = this;
        return {
            setUri(uri, options = {}) {
                if (!uri) {
                    label.element.clear();
                }
                else {
                    let name = '';
                    let description = '';
                    let extraClasses = undefined;
                    if (uri.scheme === Schemas.vscodeNotebookCell) {
                        const notebookDocument = uri.scheme === Schemas.vscodeNotebookCell ? that.notebookDocumentService.getNotebook(uri) : undefined;
                        const cellIndex = Schemas.vscodeNotebookCell ? that.notebookDocumentService.getNotebook(uri)?.getCellIndex(uri) : undefined;
                        if (notebookDocument && cellIndex !== undefined) {
                            name = localize('notebookCellLabel', "Cell {0}", `${cellIndex + 1}`);
                            const nb = notebookDocument ? that.notebookService.getNotebookTextModel(notebookDocument?.uri) : undefined;
                            const cellLanguage = nb && cellIndex !== undefined ? nb.cells[cellIndex].language : undefined;
                            extraClasses = cellLanguage ? getIconClassesForLanguageId(cellLanguage) : undefined;
                        }
                    }
                    else if (uri.scheme === Schemas.vscodeNotebookCellMetadata || uri.scheme === Schemas.vscodeNotebookCellMetadataDiff) {
                        description = localize('notebookCellMetadataLabel', "Metadata");
                    }
                    else if (uri.scheme === Schemas.vscodeNotebookCellOutput || uri.scheme === Schemas.vscodeNotebookCellOutputDiff) {
                        description = localize('notebookCellOutputLabel', "Output");
                    }
                    label.element.setResource({ name, description }, { strikethrough: options.strikethrough, forceLabel: true, hideIcon: !extraClasses, extraClasses });
                }
            },
            dispose() {
                label.dispose();
            }
        };
    }
};
WorkbenchUIElementFactory = __decorate([
    __param(0, IInstantiationService),
    __param(1, INotebookDocumentService),
    __param(2, INotebookService)
], WorkbenchUIElementFactory);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tNdWx0aURpZmZFZGl0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci9kaWZmL25vdGVib29rTXVsdGlEaWZmRWRpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUloRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDcEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDMUYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBR3JGLE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN4RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMxRyxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUd0RyxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNoSCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDdkUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsT0FBTyxFQUE0Qiw2QkFBNkIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ2xILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzVGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1QkFBdUIsQ0FB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