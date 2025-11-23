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
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { autorun } from '../../../../../../base/common/observable.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { CellEditState, CellFocusMode } from '../../notebookBrowser.js';
import { CellContentPart } from '../cellPart.js';
import { CodeCellViewModel } from '../../viewModel/codeCellViewModel.js';
import { MarkupCellViewModel } from '../../viewModel/markupCellViewModel.js';
import { NotebookCellExecutionState } from '../../../common/notebookCommon.js';
import { NOTEBOOK_CELL_EDITABLE, NOTEBOOK_CELL_EDITOR_FOCUSED, NOTEBOOK_CELL_EXECUTING, NOTEBOOK_CELL_EXECUTION_STATE, NOTEBOOK_CELL_FOCUSED, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_INPUT_COLLAPSED, NOTEBOOK_CELL_LINE_NUMBERS, NOTEBOOK_CELL_MARKDOWN_EDIT_MODE, NOTEBOOK_CELL_OUTPUT_COLLAPSED, NOTEBOOK_CELL_RESOURCE, NOTEBOOK_CELL_TYPE, NOTEBOOK_CELL_HAS_ERROR_DIAGNOSTICS } from '../../../common/notebookContextKeys.js';
import { INotebookExecutionStateService, NotebookExecutionType } from '../../../common/notebookExecutionStateService.js';
let CellContextKeyPart = class CellContextKeyPart extends CellContentPart {
    constructor(notebookEditor, instantiationService) {
        super();
        this.instantiationService = instantiationService;
        this.cellContextKeyManager = this._register(this.instantiationService.createInstance(CellContextKeyManager, notebookEditor, undefined));
    }
    didRenderCell(element) {
        this.cellContextKeyManager.updateForElement(element);
    }
};
CellContextKeyPart = __decorate([
    __param(1, IInstantiationService)
], CellContextKeyPart);
export { CellContextKeyPart };
let CellContextKeyManager = class CellContextKeyManager extends Disposable {
    constructor(notebookEditor, element, _contextKeyService, _notebookExecutionStateService) {
        super();
        this.notebookEditor = notebookEditor;
        this.element = element;
        this._contextKeyService = _contextKeyService;
        this._notebookExecutionStateService = _notebookExecutionStateService;
        this.elementDisposables = this._register(new DisposableStore());
        this._contextKeyService.bufferChangeEvents(() => {
            this.cellType = NOTEBOOK_CELL_TYPE.bindTo(this._contextKeyService);
            this.cellEditable = NOTEBOOK_CELL_EDITABLE.bindTo(this._contextKeyService);
            this.cellFocused = NOTEBOOK_CELL_FOCUSED.bindTo(this._contextKeyService);
            this.cellEditorFocused = NOTEBOOK_CELL_EDITOR_FOCUSED.bindTo(this._contextKeyService);
            this.markdownEditMode = NOTEBOOK_CELL_MARKDOWN_EDIT_MODE.bindTo(this._contextKeyService);
            this.cellRunState = NOTEBOOK_CELL_EXECUTION_STATE.bindTo(this._contextKeyService);
            this.cellExecuting = NOTEBOOK_CELL_EXECUTING.bindTo(this._contextKeyService);
            this.cellHasOutputs = NOTEBOOK_CELL_HAS_OUTPUTS.bindTo(this._contextKeyService);
            this.cellContentCollapsed = NOTEBOOK_CELL_INPUT_COLLAPSED.bindTo(this._contextKeyService);
            this.cellOutputCollapsed = NOTEBOOK_CELL_OUTPUT_COLLAPSED.bindTo(this._contextKeyService);
            this.cellLineNumbers = NOTEBOOK_CELL_LINE_NUMBERS.bindTo(this._contextKeyService);
            this.cellResource = NOTEBOOK_CELL_RESOURCE.bindTo(this._contextKeyService);
            this.cellHasErrorDiagnostics = NOTEBOOK_CELL_HAS_ERROR_DIAGNOSTICS.bindTo(this._contextKeyService);
            if (element) {
                this.updateForElement(element);
            }
        });
        this._register(this._notebookExecutionStateService.onDidChangeExecution(e => {
            if (e.type === NotebookExecutionType.cell && this.element && e.affectsCell(this.element.uri)) {
                this.updateForExecutionState();
            }
        }));
    }
    updateForElement(element) {
        this.elementDisposables.clear();
        this.element = element;
        if (!element) {
            return;
        }
        this.elementDisposables.add(element.onDidChangeState(e => this.onDidChangeState(e)));
        if (element instanceof CodeCellViewModel) {
            this.elementDisposables.add(element.onDidChangeOutputs(() => this.updateForOutputs()));
            this.elementDisposables.add(autorun(reader => {
                this.cellHasErrorDiagnostics.set(!!reader.readObservable(element.executionErrorDiagnostic));
            }));
        }
        this.elementDisposables.add(this.notebookEditor.onDidChangeActiveCell(() => this.updateForFocusState()));
        if (this.element instanceof MarkupCellViewModel) {
            this.cellType.set('markup');
        }
        else if (this.element instanceof CodeCellViewModel) {
            this.cellType.set('code');
        }
        this._contextKeyService.bufferChangeEvents(() => {
            this.updateForFocusState();
            this.updateForExecutionState();
            this.updateForEditState();
            this.updateForCollapseState();
            this.updateForOutputs();
            this.cellLineNumbers.set(this.element.lineNumbers);
            this.cellResource.set(this.element.uri.toString());
        });
    }
    onDidChangeState(e) {
        this._contextKeyService.bufferChangeEvents(() => {
            if (e.internalMetadataChanged) {
                this.updateForExecutionState();
            }
            if (e.editStateChanged) {
                this.updateForEditState();
            }
            if (e.focusModeChanged) {
                this.updateForFocusState();
            }
            if (e.cellLineNumberChanged) {
                this.cellLineNumbers.set(this.element.lineNumbers);
            }
            if (e.inputCollapsedChanged || e.outputCollapsedChanged) {
                this.updateForCollapseState();
            }
        });
    }
    updateForFocusState() {
        if (!this.element) {
            return;
        }
        const activeCell = this.notebookEditor.getActiveCell();
        this.cellFocused.set(this.notebookEditor.getActiveCell() === this.element);
        if (activeCell === this.element) {
            this.cellEditorFocused.set(this.element.focusMode === CellFocusMode.Editor);
        }
        else {
            this.cellEditorFocused.set(false);
        }
    }
    updateForExecutionState() {
        if (!this.element) {
            return;
        }
        const internalMetadata = this.element.internalMetadata;
        this.cellEditable.set(!this.notebookEditor.isReadOnly);
        const exeState = this._notebookExecutionStateService.getCellExecution(this.element.uri);
        if (this.element instanceof MarkupCellViewModel) {
            this.cellRunState.reset();
            this.cellExecuting.reset();
        }
        else if (exeState?.state === NotebookCellExecutionState.Executing) {
            this.cellRunState.set('executing');
            this.cellExecuting.set(true);
        }
        else if (exeState?.state === NotebookCellExecutionState.Pending || exeState?.state === NotebookCellExecutionState.Unconfirmed) {
            this.cellRunState.set('pending');
            this.cellExecuting.set(true);
        }
        else if (internalMetadata.lastRunSuccess === true) {
            this.cellRunState.set('succeeded');
            this.cellExecuting.set(false);
        }
        else if (internalMetadata.lastRunSuccess === false) {
            this.cellRunState.set('failed');
            this.cellExecuting.set(false);
        }
        else {
            this.cellRunState.set('idle');
            this.cellExecuting.set(false);
        }
    }
    updateForEditState() {
        if (!this.element) {
            return;
        }
        if (this.element instanceof MarkupCellViewModel) {
            this.markdownEditMode.set(this.element.getEditState() === CellEditState.Editing);
        }
        else {
            this.markdownEditMode.set(false);
        }
    }
    updateForCollapseState() {
        if (!this.element) {
            return;
        }
        this.cellContentCollapsed.set(!!this.element.isInputCollapsed);
        this.cellOutputCollapsed.set(!!this.element.isOutputCollapsed);
    }
    updateForOutputs() {
        if (this.element instanceof CodeCellViewModel) {
            this.cellHasOutputs.set(this.element.outputsViewModels.length > 0);
        }
        else {
            this.cellHasOutputs.set(false);
        }
    }
};
CellContextKeyManager = __decorate([
    __param(2, IContextKeyService),
    __param(3, INotebookExecutionStateService)
], CellContextKeyManager);
export { CellContextKeyManager };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VsbENvbnRleHRLZXlzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvdmlldy9jZWxsUGFydHMvY2VsbENvbnRleHRLZXlzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDekYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RFLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUEyQyxNQUFNLDBCQUEwQixDQUFDO0FBRWpILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNqRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRSxPQUFPLEVBQXFDLHNCQUFzQixFQUFFLDRCQUE0QixFQUFFLHVCQUF1QixFQUFFLDZCQUE2QixFQUFFLHFCQUFxQixFQUFFLHlCQUF5QixFQUFFLDZCQUE2QixFQUFFLDBCQUEwQixFQUFFLGdDQUFnQyxFQUFFLDhCQUE4QixFQUFFLHNCQUFzQixFQUFFLGtCQUFrQixFQUFFLG1DQUFtQyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDemMsT0FBTyxFQUFFLDhCQUE4QixFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFbEgsSUFBTSxrQkFB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