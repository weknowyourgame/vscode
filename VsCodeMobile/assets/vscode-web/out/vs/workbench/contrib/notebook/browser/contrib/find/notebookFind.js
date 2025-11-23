/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './media/notebookFind.css';
import { Schemas } from '../../../../../../base/common/network.js';
import { isEqual } from '../../../../../../base/common/resources.js';
import { ICodeEditorService } from '../../../../../../editor/browser/services/codeEditorService.js';
import { EditorContextKeys } from '../../../../../../editor/common/editorContextKeys.js';
import { getSelectionSearchString, NextMatchFindAction, PreviousMatchFindAction, StartFindAction, StartFindReplaceAction } from '../../../../../../editor/contrib/find/browser/findController.js';
import { localize2 } from '../../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../../platform/contextkey/common/contextkey.js';
import { NotebookFindContrib } from './notebookFindWidget.js';
import { NotebookMultiCellAction } from '../../controller/coreActions.js';
import { getNotebookEditorFromEditorPane } from '../../notebookBrowser.js';
import { registerNotebookContribution } from '../../notebookEditorExtensions.js';
import { CellUri, NotebookFindScopeType } from '../../../common/notebookCommon.js';
import { INTERACTIVE_WINDOW_IS_ACTIVE_EDITOR, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR } from '../../../common/notebookContextKeys.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { CONTEXT_FIND_WIDGET_VISIBLE } from '../../../../../../editor/contrib/find/browser/findModel.js';
registerNotebookContribution(NotebookFindContrib.id, NotebookFindContrib);
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.hideFind',
            title: localize2('notebookActions.hideFind', 'Hide Find in Notebook'),
            keybinding: {
                when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, CONTEXT_FIND_WIDGET_VISIBLE),
                primary: 9 /* KeyCode.Escape */,
                weight: 100 /* KeybindingWeight.EditorContrib */ + 5
            }
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor) {
            return;
        }
        const controller = editor.getContribution(NotebookFindContrib.id);
        controller.hide();
        editor.focus();
    }
});
registerAction2(class extends NotebookMultiCellAction {
    constructor() {
        super({
            id: 'notebook.find',
            title: localize2('notebookActions.findInNotebook', 'Find in Notebook'),
            keybinding: {
                when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.or(NOTEBOOK_IS_ACTIVE_EDITOR, INTERACTIVE_WINDOW_IS_ACTIVE_EDITOR), EditorContextKeys.focus.toNegated()),
                primary: 36 /* KeyCode.KeyF */ | 2048 /* KeyMod.CtrlCmd */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            }
        });
    }
    async runWithContext(accessor, context) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor) {
            return;
        }
        const controller = editor.getContribution(NotebookFindContrib.id);
        controller.show(undefined, { findScope: { findScopeType: NotebookFindScopeType.None } });
    }
});
function notebookContainsTextModel(uri, textModel) {
    if (textModel.uri.scheme === Schemas.vscodeNotebookCell) {
        const cellUri = CellUri.parse(textModel.uri);
        if (cellUri && isEqual(cellUri.notebook, uri)) {
            return true;
        }
    }
    return false;
}
function getSearchStringOptions(editor, opts) {
    // Get the search string result, following the same logic in _start function in 'vs/editor/contrib/find/browser/findController'
    if (opts.seedSearchStringFromSelection === 'single') {
        const selectionSearchString = getSelectionSearchString(editor, opts.seedSearchStringFromSelection, opts.seedSearchStringFromNonEmptySelection);
        if (selectionSearchString) {
            return {
                searchString: selectionSearchString,
                selection: editor.getSelection()
            };
        }
    }
    else if (opts.seedSearchStringFromSelection === 'multiple' && !opts.updateSearchScope) {
        const selectionSearchString = getSelectionSearchString(editor, opts.seedSearchStringFromSelection);
        if (selectionSearchString) {
            return {
                searchString: selectionSearchString,
                selection: editor.getSelection()
            };
        }
    }
    return undefined;
}
function isNotebookEditorValidForSearch(accessor, editor, codeEditor) {
    if (!editor) {
        return false;
    }
    if (!codeEditor.hasModel()) {
        return false;
    }
    if (!editor.hasEditorFocus() && !editor.hasWebviewFocus()) {
        const codeEditorService = accessor.get(ICodeEditorService);
        // check if the active pane contains the active text editor
        const textEditor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
        if (editor.hasModel() && textEditor && textEditor.hasModel() && notebookContainsTextModel(editor.textModel.uri, textEditor.getModel())) {
            // the active text editor is in notebook editor
            return true;
        }
        else {
            return false;
        }
    }
    return true;
}
function openFindWidget(controller, editor, codeEditor, focusWidget = true) {
    if (!editor || !codeEditor || !controller) {
        return false;
    }
    if (!codeEditor.hasModel()) {
        return false;
    }
    const searchStringOptions = getSearchStringOptions(codeEditor, {
        forceRevealReplace: false,
        seedSearchStringFromSelection: codeEditor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection !== 'never' ? 'single' : 'none',
        seedSearchStringFromNonEmptySelection: codeEditor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection === 'selection',
        seedSearchStringFromGlobalClipboard: codeEditor.getOption(50 /* EditorOption.find */).globalFindClipboard,
        shouldFocus: 1 /* FindStartFocusAction.FocusFindInput */,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: codeEditor.getOption(50 /* EditorOption.find */).loop
    });
    let options = undefined;
    const uri = codeEditor.getModel().uri;
    const data = CellUri.parse(uri);
    if (searchStringOptions?.selection && data) {
        const cell = editor.getCellByHandle(data.handle);
        if (cell) {
            options = {
                searchStringSeededFrom: { cell, range: searchStringOptions.selection },
                focus: focusWidget
            };
        }
    }
    else {
        options = { focus: focusWidget };
    }
    controller.show(searchStringOptions?.searchString, options);
    return true;
}
function findWidgetAction(accessor, codeEditor, next) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!isNotebookEditorValidForSearch(accessor, editor, codeEditor)) {
        return false;
    }
    const controller = editor?.getContribution(NotebookFindContrib.id);
    if (!controller) {
        return false;
    }
    // Check if find widget is already visible
    if (controller.isVisible()) {
        // Find widget is open, navigate
        next ? controller.findNext() : controller.findPrevious();
        return true;
    }
    else {
        // Find widget is not open, open it without focusing the widget (keep focus in editor)
        return openFindWidget(controller, editor, codeEditor, false);
    }
}
async function runFind(accessor, next) {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
        return;
    }
    const controller = editor.getContribution(NotebookFindContrib.id);
    if (controller && controller.isVisible()) {
        next ? controller.findNext() : controller.findPrevious();
    }
}
StartFindAction.addImplementation(100, (accessor, codeEditor, args) => {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!isNotebookEditorValidForSearch(accessor, editor, codeEditor)) {
        return false;
    }
    const controller = editor?.getContribution(NotebookFindContrib.id);
    return openFindWidget(controller, editor, codeEditor, true);
});
StartFindReplaceAction.addImplementation(100, (accessor, codeEditor, args) => {
    const editorService = accessor.get(IEditorService);
    const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    if (!editor) {
        return false;
    }
    if (!codeEditor.hasModel()) {
        return false;
    }
    const controller = editor.getContribution(NotebookFindContrib.id);
    const searchStringOptions = getSearchStringOptions(codeEditor, {
        forceRevealReplace: false,
        seedSearchStringFromSelection: codeEditor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection !== 'never' ? 'single' : 'none',
        seedSearchStringFromNonEmptySelection: codeEditor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection === 'selection',
        seedSearchStringFromGlobalClipboard: codeEditor.getOption(50 /* EditorOption.find */).globalFindClipboard,
        shouldFocus: 1 /* FindStartFocusAction.FocusFindInput */,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: codeEditor.getOption(50 /* EditorOption.find */).loop
    });
    if (controller) {
        controller.replace(searchStringOptions?.searchString);
        return true;
    }
    return false;
});
NextMatchFindAction.addImplementation(100, (accessor, codeEditor, args) => {
    return findWidgetAction(accessor, codeEditor, true);
});
PreviousMatchFindAction.addImplementation(100, (accessor, codeEditor, args) => {
    return findWidgetAction(accessor, codeEditor, false);
});
// Widget-focused keybindings - these handle F3/Shift+F3 when the notebook find widget has focus
// This follows the same pattern as the text editor which has separate keybindings for widget focus
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.findNext.fromWidget',
            title: localize2('notebook.findNext.fromWidget', 'Find Next'),
            keybinding: {
                when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, CONTEXT_FIND_WIDGET_VISIBLE),
                primary: 61 /* KeyCode.F3 */,
                mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 37 /* KeyCode.KeyG */, secondary: [61 /* KeyCode.F3 */] },
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
            }
        });
    }
    async run(accessor) {
        return runFind(accessor, true);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.findPrevious.fromWidget',
            title: localize2('notebook.findPrevious.fromWidget', 'Find Previous'),
            keybinding: {
                when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, CONTEXT_FIND_WIDGET_VISIBLE),
                primary: 1024 /* KeyMod.Shift */ | 61 /* KeyCode.F3 */,
                mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 37 /* KeyCode.KeyG */, secondary: [1024 /* KeyMod.Shift */ | 61 /* KeyCode.F3 */] },
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
            }
        });
    }
    async run(accessor) {
        return runFind(accessor, false);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tGaW5kLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvY29udHJpYi9maW5kL25vdGVib29rRmluZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLDBCQUEwQixDQUFDO0FBRWxDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFHckUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFFcEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFekYsT0FBTyxFQUF3Qix3QkFBd0IsRUFBcUIsbUJBQW1CLEVBQUUsdUJBQXVCLEVBQUUsZUFBZSxFQUFFLHNCQUFzQixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDM08sT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRzVGLE9BQU8sRUFBa0MsbUJBQW1CLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUM5RixPQUFPLEVBQTJCLHVCQUF1QixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbkcsT0FBTyxFQUFFLCtCQUErQixFQUFtQixNQUFNLDBCQUEwQixDQUFDO0FBQzVGLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNuRixPQUFPLEVBQUUsbUNBQW1DLEVBQUUs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