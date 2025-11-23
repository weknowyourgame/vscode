/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { NOTEBOOK_ACTIONS_CATEGORY } from './coreActions.js';
import { NOTEBOOK_CELL_HAS_HIDDEN_OUTPUTS, NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_OUTPUT_MIMETYPE } from '../../common/notebookContextKeys.js';
import * as icons from '../notebookIcons.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { copyCellOutput } from '../viewModel/cellOutputTextHelper.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { getNotebookEditorFromEditorPane } from '../notebookBrowser.js';
import { CellKind, CellUri } from '../../common/notebookCommon.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { INotebookEditorModelResolverService } from '../../common/notebookEditorModelResolverService.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { URI } from '../../../../../base/common/uri.js';
export const COPY_OUTPUT_COMMAND_ID = 'notebook.cellOutput.copy';
registerAction2(class ShowAllOutputsAction extends Action2 {
    constructor() {
        super({
            id: 'notebook.cellOuput.showEmptyOutputs',
            title: localize('notebookActions.showAllOutput', "Show Empty Outputs"),
            menu: {
                id: MenuId.NotebookOutputToolbar,
                when: ContextKeyExpr.and(NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_HAS_HIDDEN_OUTPUTS)
            },
            f1: false,
            category: NOTEBOOK_ACTIONS_CATEGORY
        });
    }
    run(accessor, context) {
        const cell = context.cell;
        if (cell && cell.cellKind === CellKind.Code) {
            for (let i = 1; i < cell.outputsViewModels.length; i++) {
                if (!cell.outputsViewModels[i].visible.get()) {
                    cell.outputsViewModels[i].setVisible(true, true);
                    cell.updateOutputHeight(i, 1, 'command');
                }
            }
        }
    }
});
registerAction2(class CopyCellOutputAction extends Action2 {
    constructor() {
        super({
            id: COPY_OUTPUT_COMMAND_ID,
            title: localize('notebookActions.copyOutput', "Copy Cell Output"),
            menu: {
                id: MenuId.NotebookOutputToolbar,
                when: NOTEBOOK_CELL_HAS_OUTPUTS
            },
            category: NOTEBOOK_ACTIONS_CATEGORY,
            icon: icons.copyIcon,
        });
    }
    async run(accessor, outputContext) {
        const editorService = accessor.get(IEditorService);
        const clipboardService = accessor.get(IClipboardService);
        const logService = accessor.get(ILogService);
        const notebookEditor = getNotebookEditorFromContext(editorService, outputContext);
        if (!notebookEditor) {
            return;
        }
        const outputViewModel = getOutputViewModelFromContext(outputContext, notebookEditor);
        if (!outputViewModel) {
            return;
        }
        const mimeType = outputViewModel.pickedMimeType?.mimeType;
        if (mimeType?.startsWith('image/')) {
            const focusOptions = { skipReveal: true, outputId: outputViewModel.model.outputId, altOutputId: outputViewModel.model.alternativeOutputId };
            await notebookEditor.focusNotebookCell(outputViewModel.cellViewModel, 'output', focusOptions);
            notebookEditor.copyOutputImage(outputViewModel);
        }
        else {
            copyCellOutput(mimeType, outputViewModel, clipboardService, logService);
        }
    }
});
export function getOutputViewModelFromId(outputId, notebookEditor) {
    const notebookViewModel = notebookEditor.getViewModel();
    if (notebookViewModel) {
        const codeCells = notebookViewModel.viewCells.filter(cell => cell.cellKind === CellKind.Code);
        for (const cell of codeCells) {
            const output = cell.outputsViewModels.find(output => output.model.outputId === outputId || output.model.alternativeOutputId === outputId);
            if (output) {
                return output;
            }
        }
    }
    return undefined;
}
function getNotebookEditorFromContext(editorService, outputContext) {
    if (outputContext && 'notebookEditor' in outputContext) {
        return outputContext.notebookEditor;
    }
    return getNotebookEditorFromEditorPane(editorService.activeEditorPane);
}
function getOutputViewModelFromContext(outputContext, notebookEditor) {
    let outputViewModel;
    if (outputContext && 'outputId' in outputContext && typeof outputContext.outputId === 'string') {
        outputViewModel = getOutputViewModelFromId(outputContext.outputId, notebookEditor);
    }
    else if (outputContext && 'outputViewModel' in outputContext) {
        outputViewModel = outputContext.outputViewModel;
    }
    if (!outputViewModel) {
        // not able to find the output from the provided context, use the active cell
        const activeCell = notebookEditor.getActiveCell();
        if (!activeCell) {
            return undefined;
        }
        if (activeCell.focusedOutputId !== undefined) {
            outputViewModel = activeCell.outputsViewModels.find(output => {
                return output.model.outputId === activeCell.focusedOutputId;
            });
        }
        else {
            outputViewModel = activeCell.outputsViewModels.find(output => output.pickedMimeType?.isTrusted);
        }
    }
    return outputViewModel;
}
export const OPEN_OUTPUT_COMMAND_ID = 'notebook.cellOutput.openInTextEditor';
registerAction2(class OpenCellOutputInEditorAction extends Action2 {
    constructor() {
        super({
            id: OPEN_OUTPUT_COMMAND_ID,
            title: localize('notebookActions.openOutputInEditor', "Open Cell Output in Text Editor"),
            f1: false,
            category: NOTEBOOK_ACTIONS_CATEGORY,
            icon: icons.copyIcon,
        });
    }
    async run(accessor, outputContext) {
        const editorService = accessor.get(IEditorService);
        const notebookModelService = accessor.get(INotebookEditorModelResolverService);
        const openerService = accessor.get(IOpenerService);
        const notebookEditor = getNotebookEditorFromContext(editorService, outputContext);
        if (!notebookEditor) {
            return;
        }
        const outputViewModel = getOutputViewModelFromContext(outputContext, notebookEditor);
        if (outputViewModel?.model.outputId && notebookEditor.textModel?.uri) {
            // reserve notebook document reference since the active notebook editor might not be pinned so it can be replaced by the output editor
            const ref = await notebookModelService.resolve(notebookEditor.textModel.uri);
            await openerService.open(CellUri.generateCellOutputUriWithId(notebookEditor.textModel.uri, outputViewModel.model.outputId));
            ref.dispose();
        }
    }
});
export const SAVE_OUTPUT_IMAGE_COMMAND_ID = 'notebook.cellOutput.saveImage';
registerAction2(class SaveCellOutputImageAction extends Action2 {
    constructor() {
        super({
            id: SAVE_OUTPUT_IMAGE_COMMAND_ID,
            title: localize('notebookActions.saveOutputImage', "Save Image"),
            menu: {
                id: MenuId.NotebookOutputToolbar,
                when: ContextKeyExpr.regex(NOTEBOOK_CELL_OUTPUT_MIMETYPE.key, /^image\//)
            },
            f1: false,
            category: NOTEBOOK_ACTIONS_CATEGORY,
            icon: icons.saveIcon,
        });
    }
    async run(accessor, outputContext) {
        const editorService = accessor.get(IEditorService);
        const fileDialogService = accessor.get(IFileDialogService);
        const fileService = accessor.get(IFileService);
        const logService = accessor.get(ILogService);
        const notebookEditor = getNotebookEditorFromContext(editorService, outputContext);
        if (!notebookEditor) {
            return;
        }
        const outputViewModel = getOutputViewModelFromContext(outputContext, notebookEditor);
        if (!outputViewModel) {
            return;
        }
        const mimeType = outputViewModel.pickedMimeType?.mimeType;
        // Only handle image mime types
        if (!mimeType?.startsWith('image/')) {
            return;
        }
        const outputItem = outputViewModel.model.outputs.find(output => output.mime === mimeType);
        if (!outputItem) {
            logService.error('Could not find output item with mime type', mimeType);
            return;
        }
        // Determine file extension based on mime type
        const mimeToExt = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/svg+xml': 'svg',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
            'image/tiff': 'tiff'
        };
        const extension = mimeToExt[mimeType] || 'png';
        const defaultFileName = `image.${extension}`;
        const defaultUri = notebookEditor.textModel?.uri
            ? URI.joinPath(URI.file(notebookEditor.textModel.uri.fsPath), '..', defaultFileName)
            : undefined;
        const uri = await fileDialogService.showSaveDialog({
            defaultUri,
            filters: [{
                    name: localize('imageFiles', "Image Files"),
                    extensions: [extension]
                }]
        });
        if (!uri) {
            return; // User cancelled
        }
        try {
            const imageData = outputItem.data;
            await fileService.writeFile(uri, imageData);
            logService.info('Saved image output to', uri.toString());
        }
        catch (error) {
            logService.error('Failed to save image output', error);
        }
    }
});
export const OPEN_OUTPUT_IN_OUTPUT_PREVIEW_COMMAND_ID = 'notebook.cellOutput.openInOutputPreview';
registerAction2(class OpenCellOutputInNotebookOutputEditorAction extends Action2 {
    constructor() {
        super({
            id: OPEN_OUTPUT_IN_OUTPUT_PREVIEW_COMMAND_ID,
            title: localize('notebookActions.openOutputInNotebookOutputEditor', "Open in Output Preview"),
            menu: {
                id: MenuId.NotebookOutputToolbar,
                when: ContextKeyExpr.and(NOTEBOOK_CELL_HAS_OUTPUTS, ContextKeyExpr.equals('config.notebook.output.openInPreviewEditor.enabled', true))
            },
            f1: false,
            category: NOTEBOOK_ACTIONS_CATEGORY,
        });
    }
    async run(accessor, outputContext) {
        const editorService = accessor.get(IEditorService);
        const openerService = accessor.get(IOpenerService);
        const notebookEditor = getNotebookEditorFromContext(editorService, outputContext);
        if (!notebookEditor) {
            return;
        }
        const outputViewModel = getOutputViewModelFromContext(outputContext, notebookEditor);
        if (!outputViewModel) {
            return;
        }
        const genericCellViewModel = outputViewModel.cellViewModel;
        if (!genericCellViewModel) {
            return;
        }
        // get cell index
        const cellViewModel = notebookEditor.getCellByHandle(genericCellViewModel.handle);
        if (!cellViewModel) {
            return;
        }
        const cellIndex = notebookEditor.getCellIndex(cellViewModel);
        if (cellIndex === undefined) {
            return;
        }
        // get output index
        const outputIndex = genericCellViewModel.outputsViewModels.indexOf(outputViewModel);
        if (outputIndex === -1) {
            return;
        }
        if (!notebookEditor.textModel) {
            return;
        }
        // craft rich output URI to pass data to the notebook output editor/viewer
        const outputURI = CellUri.generateOutputEditorUri(notebookEditor.textModel.uri, cellViewModel.id, cellIndex, outputViewModel.model.outputId, outputIndex);
        openerService.open(outputURI, { openToSide: true });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VsbE91dHB1dEFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci9jb250cm9sbGVyL2NlbGxPdXRwdXRBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNyRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDakYsT0FBTyxFQUFnQyx5QkFBeUIsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQzNGLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSx5QkFBeUIsRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2pKLE9BQU8sS0FBSyxLQUFLLE1BQU0scUJBQXFCLENBQUM7QUFDN0MsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckYsT0FBTyxFQUF5RCwrQkFBK0IsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQy9ILE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFbkUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxrQkFBa0IsRUFB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