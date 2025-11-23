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
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { observableValue, transaction } from '../../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { CellEditState } from '../../../../notebook/browser/notebookBrowser.js';
import { INotebookEditorService } from '../../../../notebook/browser/services/notebookEditorService.js';
import { CellKind } from '../../../../notebook/common/notebookCommon.js';
import { ChatEditingTextModelChangeService } from '../chatEditingTextModelChangeService.js';
/**
 * This is very closely similar to the ChatEditingModifiedDocumentEntry class.
 * Most of the code has been borrowed from there, as a cell is effectively a document.
 * Hence most of the same functionality applies.
 */
let ChatEditingNotebookCellEntry = class ChatEditingNotebookCellEntry extends Disposable {
    get isDisposed() {
        return this._store.isDisposed;
    }
    get isEditFromUs() {
        return this._textModelChangeService.isEditFromUs;
    }
    get allEditsAreFromUs() {
        return this._textModelChangeService.allEditsAreFromUs;
    }
    get diffInfo() {
        return this._textModelChangeService.diffInfo;
    }
    constructor(notebookUri, cell, modifiedModel, originalModel, isExternalEditInProgress, disposables, notebookEditorService, instantiationService) {
        super();
        this.notebookUri = notebookUri;
        this.cell = cell;
        this.modifiedModel = modifiedModel;
        this.originalModel = originalModel;
        this.notebookEditorService = notebookEditorService;
        this.instantiationService = instantiationService;
        this._maxModifiedLineNumber = observableValue(this, 0);
        this.maxModifiedLineNumber = this._maxModifiedLineNumber;
        this._stateObs = observableValue(this, 0 /* ModifiedFileEntryState.Modified */);
        this.state = this._stateObs;
        this.initialContent = this.originalModel.getValue();
        this._register(disposables);
        this._textModelChangeService = this._register(this.instantiationService.createInstance(ChatEditingTextModelChangeService, this.originalModel, this.modifiedModel, this.state, isExternalEditInProgress));
        this._register(this._textModelChangeService.onDidAcceptOrRejectAllHunks(action => {
            this.revertMarkdownPreviewState();
            this._stateObs.set(action, undefined);
        }));
        this._register(this._textModelChangeService.onDidUserEditModel(() => {
            const didResetToOriginalContent = this.modifiedModel.getValue() === this.initialContent;
            if (this._stateObs.get() === 0 /* ModifiedFileEntryState.Modified */ && didResetToOriginalContent) {
                this._stateObs.set(2 /* ModifiedFileEntryState.Rejected */, undefined);
            }
        }));
    }
    hasModificationAt(range) {
        return this._textModelChangeService.hasHunkAt(range);
    }
    clearCurrentEditLineDecoration() {
        if (this.modifiedModel.isDisposed()) {
            return;
        }
        this._textModelChangeService.clearCurrentEditLineDecoration();
    }
    async acceptAgentEdits(textEdits, isLastEdits, responseModel) {
        const { maxLineNumber } = await this._textModelChangeService.acceptAgentEdits(this.modifiedModel.uri, textEdits, isLastEdits, responseModel);
        transaction((tx) => {
            if (!isLastEdits) {
                this._stateObs.set(0 /* ModifiedFileEntryState.Modified */, tx);
                this._maxModifiedLineNumber.set(maxLineNumber, tx);
            }
            else {
                this._maxModifiedLineNumber.set(0, tx);
            }
        });
    }
    revertMarkdownPreviewState() {
        if (this.cell.cellKind !== CellKind.Markup) {
            return;
        }
        const notebookEditor = this.notebookEditorService.retrieveExistingWidgetFromURI(this.notebookUri)?.value;
        if (notebookEditor) {
            const vm = notebookEditor.getCellByHandle(this.cell.handle);
            if (vm?.getEditState() === CellEditState.Editing &&
                (vm.editStateSource === 'chatEdit' || vm.editStateSource === 'chatEditNavigation')) {
                vm?.updateEditState(CellEditState.Preview, 'chatEdit');
            }
        }
    }
    async keep(change) {
        return this._textModelChangeService.diffInfo.get().keep(change);
    }
    async undo(change) {
        return this._textModelChangeService.diffInfo.get().undo(change);
    }
};
ChatEditingNotebookCellEntry = __decorate([
    __param(6, INotebookEditorService),
    __param(7, IInstantiationService)
], ChatEditingNotebookCellEntry);
export { ChatEditingNotebookCellEntry };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdOb3RlYm9va0NlbGxFbnRyeS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvbm90ZWJvb2svY2hhdEVkaXRpbmdOb3RlYm9va0NlbGxFbnRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFtQixNQUFNLDRDQUE0QyxDQUFDO0FBQ3pGLE9BQU8sRUFBZSxlQUFlLEVBQUUsV0FBVyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFPeEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBRXhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUd6RSxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUc1Rjs7OztHQUlHO0FBQ0ksSUFBTSw0QkFBNEIsR0FBbEMsTUFBTSw0QkFBNkIsU0FBUSxVQUFVO0lBQzNELElBQVcsVUFBVTtRQUNwQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO0lBQy9CLENBQUM7SUFFRCxJQUFXLFlBQVk7UUFDdEIsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBWSxDQUFDO0lBQ2xELENBQUM7SUFFRCxJQUFXLGlCQUFpQjtRQUMzQixPQUFPLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxpQkFBaUIsQ0FBQztJQUN2RCxDQUFDO0lBQ0QsSUFBVyxRQUFRO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQztJQUM5QyxD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