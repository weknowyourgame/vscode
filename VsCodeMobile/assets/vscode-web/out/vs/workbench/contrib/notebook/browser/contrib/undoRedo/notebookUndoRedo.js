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
import { registerWorkbenchContribution2 } from '../../../../../common/contributions.js';
import { CellKind } from '../../../common/notebookCommon.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { CellEditState, getNotebookEditorFromEditorPane } from '../../notebookBrowser.js';
import { RedoCommand, UndoCommand } from '../../../../../../editor/browser/editorExtensions.js';
let NotebookUndoRedoContribution = class NotebookUndoRedoContribution extends Disposable {
    static { this.ID = 'workbench.contrib.notebookUndoRedo'; }
    constructor(_editorService) {
        super();
        this._editorService = _editorService;
        const PRIORITY = 105;
        this._register(UndoCommand.addImplementation(PRIORITY, 'notebook-undo-redo', () => {
            const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
            const viewModel = editor?.getViewModel();
            if (editor && editor.hasEditorFocus() && editor.hasModel() && viewModel) {
                return viewModel.undo().then(cellResources => {
                    if (cellResources?.length) {
                        for (let i = 0; i < editor.getLength(); i++) {
                            const cell = editor.cellAt(i);
                            if (cell.cellKind === CellKind.Markup && cellResources.find(resource => resource.fragment === cell.model.uri.fragment)) {
                                cell.updateEditState(CellEditState.Editing, 'undo');
                            }
                        }
                        editor?.setOptions({ cellOptions: { resource: cellResources[0] }, preserveFocus: true });
                    }
                });
            }
            return false;
        }));
        this._register(RedoCommand.addImplementation(PRIORITY, 'notebook-undo-redo', () => {
            const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
            const viewModel = editor?.getViewModel();
            if (editor && editor.hasEditorFocus() && editor.hasModel() && viewModel) {
                return viewModel.redo().then(cellResources => {
                    if (cellResources?.length) {
                        for (let i = 0; i < editor.getLength(); i++) {
                            const cell = editor.cellAt(i);
                            if (cell.cellKind === CellKind.Markup && cellResources.find(resource => resource.fragment === cell.model.uri.fragment)) {
                                cell.updateEditState(CellEditState.Editing, 'redo');
                            }
                        }
                        editor?.setOptions({ cellOptions: { resource: cellResources[0] }, preserveFocus: true });
                    }
                });
            }
            return false;
        }));
    }
};
NotebookUndoRedoContribution = __decorate([
    __param(0, IEditorService)
], NotebookUndoRedoContribution);
registerWorkbenchContribution2(NotebookUndoRedoContribution.ID, NotebookUndoRedoContribution, 2 /* WorkbenchPhase.BlockRestore */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tVbmRvUmVkby5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvdW5kb1JlZG8vbm90ZWJvb2tVbmRvUmVkby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEUsT0FBTyxFQUFrQiw4QkFBOEIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDeEYsT0FBTyxFQUFFLGFBQWEsRUFBRSwrQkFBK0IsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzFGLE9BQU8sRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFHaEcsSUFBTSw0QkFBNEIsR0FBbEMsTUFBTSw0QkFBNkIsU0FBUSxVQUFVO2FBRXBDLE9BQUUsR0FBRyxvQ0FBb0MsQUFBdkMsQ0FBd0M7SUFFMUQsWUFBNkMsY0FBOEI7UUFDMUUsS0FBSyxFQUFFLENBQUM7UUFEb0MsbUJBQWMsR0FBZCxjQUFjLENBQWdCO1FBRzFFLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQztRQUNyQixJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO1lBQ2pGLE1BQU0sTUFBTSxHQUFHLCtCQUErQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUNyRixNQUFNLFNBQVMsR0FBRyxNQUFNLEVBQUUsWUFBWSxFQUFtQyxDQUFDO1lBQzFFLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxjQUFjLEVBQUUsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQ3pFLE9BQU8sU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRTtvQkFDNUMsSUFBSSxhQUFhLEVBQUUsTUFBTSxFQUFFLENBQUM7d0JBQzNCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQzs0QkFDN0MsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQzs0QkFDOUIsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQyxNQUFNLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQ0FDeEgsSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDOzRCQUNyRCxDQUFDO3dCQUNGLENBQUM7d0JBRUQsTUFBTSxFQUFFLFVBQVUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxFQUFFLFFBQVEsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztvQkFDMUYsQ0FBQztnQkFDRixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUM7WUFFRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO1lBQ2pGLE1BQU0sTUFBTSxHQUFHLCtCQUErQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUNyRixNQUFNLFNBQVMsR0FBRyxNQUFNLEVBQUUsWUFBWSxFQUFtQyxDQUFDO1lBRTFFLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxjQUFjLEVBQUUsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQ3pFLE9BQU8sU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRTtvQkFDNUMsSUFBSSxhQUFhLEVBQUUsTUFBTSxFQUFFLENBQUM7d0JBQzNCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQzs0QkFDN0MsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQzs0QkFDOUIsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQyxNQUFNLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQ0FDeEgsSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDOzRCQUNyRCxDQUFDO3dCQUNGLENBQUM7d0JBRUQsTUFBTSxFQUFFLFVBQVUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxFQUFFLFFBQVEsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztvQkFDMUYsQ0FBQztnQkFDRixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUM7WUFFRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDOztBQWxESSw0QkFBNEI7SUFJcEIsV0FBQSxjQUFjLENBQUE7R0FKdEIsNEJBQTRCLENBbURqQztBQUVELDhCQUE4QixDQUFDLDRCQUE0QixDQUFDLEVBQUUsRUFBRSw0QkFBNEIsc0NBQThCLENBQUMifQ==