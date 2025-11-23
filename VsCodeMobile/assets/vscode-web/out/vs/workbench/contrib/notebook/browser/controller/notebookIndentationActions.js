/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../../nls.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { IBulkEditService, ResourceTextEdit } from '../../../../../editor/browser/services/bulkEditService.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { INotebookEditorService } from '../services/notebookEditorService.js';
import { NotebookSetting } from '../../common/notebookCommon.js';
import { isNotebookEditorInput } from '../../common/notebookEditorInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
export class NotebookIndentUsingTabs extends Action2 {
    static { this.ID = 'notebook.action.indentUsingTabs'; }
    constructor() {
        super({
            id: NotebookIndentUsingTabs.ID,
            title: nls.localize('indentUsingTabs', "Indent Using Tabs"),
            precondition: undefined,
        });
    }
    run(accessor, ...args) {
        changeNotebookIndentation(accessor, false, false);
    }
}
export class NotebookIndentUsingSpaces extends Action2 {
    static { this.ID = 'notebook.action.indentUsingSpaces'; }
    constructor() {
        super({
            id: NotebookIndentUsingSpaces.ID,
            title: nls.localize('indentUsingSpaces', "Indent Using Spaces"),
            precondition: undefined,
        });
    }
    run(accessor, ...args) {
        changeNotebookIndentation(accessor, true, false);
    }
}
export class NotebookChangeTabDisplaySize extends Action2 {
    static { this.ID = 'notebook.action.changeTabDisplaySize'; }
    constructor() {
        super({
            id: NotebookChangeTabDisplaySize.ID,
            title: nls.localize('changeTabDisplaySize', "Change Tab Display Size"),
            precondition: undefined,
        });
    }
    run(accessor, ...args) {
        changeNotebookIndentation(accessor, true, true);
    }
}
export class NotebookIndentationToSpacesAction extends Action2 {
    static { this.ID = 'notebook.action.convertIndentationToSpaces'; }
    constructor() {
        super({
            id: NotebookIndentationToSpacesAction.ID,
            title: nls.localize('convertIndentationToSpaces', "Convert Indentation to Spaces"),
            precondition: undefined,
        });
    }
    run(accessor, ...args) {
        convertNotebookIndentation(accessor, true);
    }
}
export class NotebookIndentationToTabsAction extends Action2 {
    static { this.ID = 'notebook.action.convertIndentationToTabs'; }
    constructor() {
        super({
            id: NotebookIndentationToTabsAction.ID,
            title: nls.localize('convertIndentationToTabs', "Convert Indentation to Tabs"),
            precondition: undefined,
        });
    }
    run(accessor, ...args) {
        convertNotebookIndentation(accessor, false);
    }
}
function changeNotebookIndentation(accessor, insertSpaces, displaySizeOnly) {
    const editorService = accessor.get(IEditorService);
    const configurationService = accessor.get(IConfigurationService);
    const notebookEditorService = accessor.get(INotebookEditorService);
    const quickInputService = accessor.get(IQuickInputService);
    // keep this check here to pop on non-notebook actions
    const activeInput = editorService.activeEditorPane?.input;
    const isNotebook = isNotebookEditorInput(activeInput);
    if (!isNotebook) {
        return;
    }
    // get notebook editor to access all codeEditors
    const notebookEditor = notebookEditorService.retrieveExistingWidgetFromURI(activeInput.resource)?.value;
    if (!notebookEditor) {
        return;
    }
    const picks = [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({
        id: n.toString(),
        label: n.toString(),
    }));
    // store the initial values of the configuration
    const initialConfig = configurationService.getValue(NotebookSetting.cellEditorOptionsCustomizations);
    const initialInsertSpaces = initialConfig['editor.insertSpaces'];
    // remove the initial values from the configuration
    delete initialConfig['editor.indentSize'];
    delete initialConfig['editor.tabSize'];
    delete initialConfig['editor.insertSpaces'];
    setTimeout(() => {
        quickInputService.pick(picks, { placeHolder: nls.localize({ key: 'selectTabWidth', comment: ['Tab corresponds to the tab key'] }, "Select Tab Size for Current File") }).then(pick => {
            if (pick) {
                const pickedVal = parseInt(pick.label, 10);
                if (displaySizeOnly) {
                    configurationService.updateValue(NotebookSetting.cellEditorOptionsCustomizations, {
                        ...initialConfig,
                        'editor.tabSize': pickedVal,
                        'editor.indentSize': pickedVal,
                        'editor.insertSpaces': initialInsertSpaces
                    });
                }
                else {
                    configurationService.updateValue(NotebookSetting.cellEditorOptionsCustomizations, {
                        ...initialConfig,
                        'editor.tabSize': pickedVal,
                        'editor.indentSize': pickedVal,
                        'editor.insertSpaces': insertSpaces
                    });
                }
            }
        });
    }, 50 /* quick input is sensitive to being opened so soon after another */);
}
function convertNotebookIndentation(accessor, tabsToSpaces) {
    const editorService = accessor.get(IEditorService);
    const configurationService = accessor.get(IConfigurationService);
    const logService = accessor.get(ILogService);
    const textModelService = accessor.get(ITextModelService);
    const notebookEditorService = accessor.get(INotebookEditorService);
    const bulkEditService = accessor.get(IBulkEditService);
    // keep this check here to pop on non-notebook
    const activeInput = editorService.activeEditorPane?.input;
    const isNotebook = isNotebookEditorInput(activeInput);
    if (!isNotebook) {
        return;
    }
    // get notebook editor to access all codeEditors
    const notebookTextModel = notebookEditorService.retrieveExistingWidgetFromURI(activeInput.resource)?.value?.textModel;
    if (!notebookTextModel) {
        return;
    }
    const disposable = new DisposableStore();
    try {
        Promise.all(notebookTextModel.cells.map(async (cell) => {
            const ref = await textModelService.createModelReference(cell.uri);
            disposable.add(ref);
            const textEditorModel = ref.object.textEditorModel;
            const modelOpts = cell.textModel?.getOptions();
            if (!modelOpts) {
                return;
            }
            const edits = getIndentationEditOperations(textEditorModel, modelOpts.tabSize, tabsToSpaces);
            bulkEditService.apply(edits, { label: nls.localize('convertIndentation', "Convert Indentation"), code: 'undoredo.convertIndentation', });
        })).then(() => {
            // store the initial values of the configuration
            const initialConfig = configurationService.getValue(NotebookSetting.cellEditorOptionsCustomizations);
            const initialIndentSize = initialConfig['editor.indentSize'];
            const initialTabSize = initialConfig['editor.tabSize'];
            // remove the initial values from the configuration
            delete initialConfig['editor.indentSize'];
            delete initialConfig['editor.tabSize'];
            delete initialConfig['editor.insertSpaces'];
            configurationService.updateValue(NotebookSetting.cellEditorOptionsCustomizations, {
                ...initialConfig,
                'editor.tabSize': initialTabSize,
                'editor.indentSize': initialIndentSize,
                'editor.insertSpaces': tabsToSpaces
            });
            disposable.dispose();
        });
    }
    catch {
        logService.error('Failed to convert indentation to spaces for notebook cells.');
    }
}
function getIndentationEditOperations(model, tabSize, tabsToSpaces) {
    if (model.getLineCount() === 1 && model.getLineMaxColumn(1) === 1) {
        // Model is empty
        return [];
    }
    let spaces = '';
    for (let i = 0; i < tabSize; i++) {
        spaces += ' ';
    }
    const spacesRegExp = new RegExp(spaces, 'gi');
    const edits = [];
    for (let lineNumber = 1, lineCount = model.getLineCount(); lineNumber <= lineCount; lineNumber++) {
        let lastIndentationColumn = model.getLineFirstNonWhitespaceColumn(lineNumber);
        if (lastIndentationColumn === 0) {
            lastIndentationColumn = model.getLineMaxColumn(lineNumber);
        }
        if (lastIndentationColumn === 1) {
            continue;
        }
        const originalIndentationRange = new Range(lineNumber, 1, lineNumber, lastIndentationColumn);
        const originalIndentation = model.getValueInRange(originalIndentationRange);
        const newIndentation = (tabsToSpaces
            ? originalIndentation.replace(/\t/ig, spaces)
            : originalIndentation.replace(spacesRegExp, '\t'));
        edits.push(new ResourceTextEdit(model.uri, { range: originalIndentationRange, text: newIndentation }));
    }
    return edits;
}
registerAction2(NotebookIndentUsingSpaces);
registerAction2(NotebookIndentUsingTabs);
registerAction2(NotebookChangeTabDisplaySize);
registerAction2(NotebookIndentationToSpacesAction);
registerAction2(NotebookIndentationToTabsAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tJbmRlbnRhdGlvbkFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci9jb250cm9sbGVyL25vdGVib29rSW5kZW50YXRpb25BY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sdUJBQXVCLENBQUM7QUFDN0MsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRTFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUVuRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM3RixPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDakUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRXJGLE1BQU0sT0FBTyx1QkFBd0IsU0FBUSxPQUFPO2FBQzVCLE9BQUUsR0FBRyxpQ0FBaUMsQ0FBQztJQUU5RDtRQUNDLEtBQUssQ0FBQztZ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