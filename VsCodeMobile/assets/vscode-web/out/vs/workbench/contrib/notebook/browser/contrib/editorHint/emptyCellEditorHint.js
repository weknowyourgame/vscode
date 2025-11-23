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
import { Schemas } from '../../../../../../base/common/network.js';
import { registerEditorContribution } from '../../../../../../editor/browser/editorExtensions.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IChatAgentService } from '../../../../chat/common/chatAgents.js';
import { EmptyTextEditorHintContribution } from '../../../../codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint.js';
import { IInlineChatSessionService } from '../../../../inlineChat/browser/inlineChatSessionService.js';
import { getNotebookEditorFromEditorPane } from '../../notebookBrowser.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
let EmptyCellEditorHintContribution = class EmptyCellEditorHintContribution extends EmptyTextEditorHintContribution {
    static { this.CONTRIB_ID = 'notebook.editor.contrib.emptyCellEditorHint'; }
    constructor(editor, _editorService, configurationService, inlineChatSessionService, chatAgentService, instantiationService) {
        super(editor, configurationService, inlineChatSessionService, chatAgentService, instantiationService);
        this._editorService = _editorService;
        const activeEditor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
        if (!activeEditor) {
            return;
        }
        this._register(activeEditor.onDidChangeActiveCell(() => this.update()));
    }
    shouldRenderHint() {
        const model = this.editor.getModel();
        if (!model) {
            return false;
        }
        const isNotebookCell = model?.uri.scheme === Schemas.vscodeNotebookCell;
        if (!isNotebookCell) {
            return false;
        }
        const activeEditor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
        if (!activeEditor || !activeEditor.isDisposed) {
            return false;
        }
        const shouldRenderHint = super.shouldRenderHint();
        if (!shouldRenderHint) {
            return false;
        }
        const activeCell = activeEditor.getActiveCell();
        if (activeCell?.uri.fragment !== model.uri.fragment) {
            return false;
        }
        return true;
    }
};
EmptyCellEditorHintContribution = __decorate([
    __param(1, IEditorService),
    __param(2, IConfigurationService),
    __param(3, IInlineChatSessionService),
    __param(4, IChatAgentService),
    __param(5, IInstantiationService)
], EmptyCellEditorHintContribution);
export { EmptyCellEditorHintContribution };
registerEditorContribution(EmptyCellEditorHintContribution.CONTRIB_ID, EmptyCellEditorHintContribution, 0 /* EditorContributionInstantiation.Eager */); // eager because it needs to render a help message
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1wdHlDZWxsRWRpdG9ySGludC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvZWRpdG9ySGludC9lbXB0eUNlbGxFZGl0b3JIaW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVuRSxPQUFPLEVBQW1DLDBCQUEwQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDbkksT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDMUUsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sMkVBQTJFLENBQUM7QUFDNUgsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDdkcsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0UsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBRWxHLElBQU0sK0JBQStCLEdBQXJDLE1BQU0sK0JBQWdDLFNBQVEsK0JBQStCO2FBQzVELGVBQVUsR0FBRyw2Q0FBNkMsQUFBaEQsQ0FBaUQ7SUFDbEYsWUFDQyxNQUFtQixFQUNjLGNBQThCLEVBQ3hDLG9CQUEyQyxFQUN2Qyx3QkFBbUQsRUFDM0QsZ0JBQW1DLEVBQy9CLG9CQUEyQztRQUVsRSxLQUFLLENBQ0osTUFBTSxFQUNOLG9CQUFvQixFQUNwQix3QkFBd0IsRUFDeEIsZ0JBQWdCLEVBQ2hCLG9CQUFvQixDQUNwQixDQUFDO1FBWitCLG1CQUFjLEdBQWQsY0FBYyxDQUFnQjtRQWMvRCxNQUFNLFlBQVksR0FBRywrQkFBK0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDM0YsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ25CLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMscUJBQXFCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRWtCLGdCQUFnQjtRQUNsQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3JDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELE1BQU0sY0FBYyxHQUFHLEtBQUssRUFBRSxHQUFHLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQztRQUN4RSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDckIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQUcsK0JBQStCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzNGLElBQUksQ0FBQyxZQUFZLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDL0MsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUNsRCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN2QixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxZQUFZLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFaEQsSUFBSSxVQUFVLEVBQUUsR0FBRyxDQUFDLFFBQVEsS0FBSyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3JELE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQzs7QUF0RFcsK0JBQStCO0lBSXpDLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLHlCQUF5QixDQUFBO0lBQ3pCLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsV0FBQSxxQkFBcUIsQ0FBQTtHQVJYLCtCQUErQixDQXVEM0M7O0FBRUQsMEJBQTBCLENBQUMsK0JBQStCLENBQUMsVUFBVSxFQUFFLCtCQUErQixnREFBd0MsQ0FBQyxDQUFDLGtEQUFrRCJ9