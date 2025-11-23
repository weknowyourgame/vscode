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
var NotebookOutputEditorInput_1;
import * as nls from '../../../../../nls.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { INotebookEditorModelResolverService } from '../../common/notebookEditorModelResolverService.js';
import { isEqual } from '../../../../../base/common/resources.js';
class ResolvedNotebookOutputEditorInputModel {
    constructor(resolvedNotebookEditorModel, notebookUri, cell, outputId) {
        this.resolvedNotebookEditorModel = resolvedNotebookEditorModel;
        this.notebookUri = notebookUri;
        this.cell = cell;
        this.outputId = outputId;
    }
    dispose() {
        this.resolvedNotebookEditorModel.dispose();
    }
}
// TODO @Yoyokrazy -- future feat. for viewing static outputs -- encode mime + data
// export class NotebookOutputViewerInput extends EditorInput {
// 	static readonly ID: string = 'workbench.input.notebookOutputViewerInput';
// }
let NotebookOutputEditorInput = class NotebookOutputEditorInput extends EditorInput {
    static { NotebookOutputEditorInput_1 = this; }
    static { this.ID = 'workbench.input.notebookOutputEditorInput'; }
    constructor(notebookUri, cellIndex, outputId, outputIndex, notebookEditorModelResolverService) {
        super();
        this.notebookEditorModelResolverService = notebookEditorModelResolverService;
        this._notebookUri = notebookUri;
        this.cellUri = undefined;
        this.cellIndex = cellIndex;
        this.outputId = outputId;
        this.outputIndex = outputIndex;
    }
    get typeId() {
        return NotebookOutputEditorInput_1.ID;
    }
    async resolve() {
        if (!this._notebookRef) {
            this._notebookRef = await this.notebookEditorModelResolverService.resolve(this._notebookUri);
        }
        const cell = this._notebookRef.object.notebook.cells[this.cellIndex];
        if (!cell) {
            throw new Error('Cell not found');
        }
        this.cellUri = cell.uri;
        const resolvedOutputId = cell.outputs[this.outputIndex]?.outputId;
        if (!resolvedOutputId) {
            throw new Error('Output not found');
        }
        if (!this.outputId) {
            this.outputId = resolvedOutputId;
        }
        return new ResolvedNotebookOutputEditorInputModel(this._notebookRef.object, this._notebookUri, cell, resolvedOutputId);
    }
    getSerializedData() {
        // need to translate from uris -> current indexes
        // uris aren't deterministic across reloads, so indices are best option
        if (!this._notebookRef) {
            return;
        }
        const cellIndex = this._notebookRef.object.notebook.cells.findIndex(c => isEqual(c.uri, this.cellUri));
        const cell = this._notebookRef.object.notebook.cells[cellIndex];
        if (!cell) {
            return;
        }
        const outputIndex = cell.outputs.findIndex(o => o.outputId === this.outputId);
        if (outputIndex === -1) {
            return;
        }
        return {
            notebookUri: this._notebookUri,
            cellIndex: cellIndex,
            outputIndex: outputIndex,
        };
    }
    getName() {
        return nls.localize('notebookOutputEditorInput', "Notebook Output Preview");
    }
    get editorId() {
        return 'notebookOutputEditor';
    }
    get resource() {
        return;
    }
    get capabilities() {
        return 2 /* EditorInputCapabilities.Readonly */;
    }
    dispose() {
        super.dispose();
    }
};
NotebookOutputEditorInput = NotebookOutputEditorInput_1 = __decorate([
    __param(4, INotebookEditorModelResolverService)
], NotebookOutputEditorInput);
export { NotebookOutputEditorInput };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tPdXRwdXRFZGl0b3JJbnB1dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL291dHB1dEVkaXRvci9ub3RlYm9va091dHB1dEVkaXRvcklucHV0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLHVCQUF1QixDQUFDO0FBSTdDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUV2RSxPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN6RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFJbEUsTUFBTSxzQ0FBc0M7SUFDM0MsWUFDVSwyQkFBeUQsRUFDekQsV0FBZ0IsRUFDaEIsSUFBMkIsRUFDM0IsUUFBZ0I7UUFIaEIsZ0NBQTJCLEdBQTNCLDJCQUEyQixDQUE4QjtRQUN6RCxnQkFBVyxHQUFYLFdBQVcsQ0FBSztRQUNoQixTQUFJLEdBQUosSUFBSSxDQUF1QjtRQUMzQixhQUFRLEdBQVIsUUFBUSxDQUFRO0lBQ3RCLENBQUM7SUFFTCxPQUFPO1FBQ04sSUFBSSxDQUFDLDJCQUEyQixDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzVDLENBQUM7Q0FDRDtBQUVELG1GQUFtRjtBQUNuRiwrREFBK0Q7QUFDL0QsNkVBQTZFO0FBQzdFLElBQUk7QUFFRyxJQUFNLHlCQUF5QixHQUEvQixNQUFNLHlCQUEwQixTQUFRLFdBQVc7O2FBQ3pDLE9BQUUsR0FBVywyQ0FBMkMsQUFBdEQsQ0FBdUQ7SUFZekUsWUFDQyxXQUFnQixFQUNoQixTQUFpQixFQUNqQixRQUE0QixFQUM1QixXQUFtQixFQUNtQyxrQ0FBdUU7UUFFN0gsS0FBSyxFQUFFLENBQUM7UUFGOEMsdUNBQWtD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