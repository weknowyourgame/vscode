/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { normalizeDriveLetter } from '../../../../../../base/common/labels.js';
import { basenameOrAuthority } from '../../../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { localize } from '../../../../../../nls.js';
import { CellUri } from '../../../common/notebookCommon.js';
export const NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST = [
    'text/plain',
    'text/html',
    'application/vnd.code.notebook.error',
    'application/vnd.code.notebook.stdout',
    'application/x.notebook.stdout',
    'application/x.notebook.stream',
    'application/vnd.code.notebook.stderr',
    'application/x.notebook.stderr',
    'image/png',
    'image/jpeg',
    'image/svg',
];
export function createNotebookOutputVariableEntry(outputViewModel, mimeType, notebookEditor) {
    // get the cell index
    const cellFromViewModelHandle = outputViewModel.cellViewModel.handle;
    const notebookModel = notebookEditor.textModel;
    const cell = notebookEditor.getCellByHandle(cellFromViewModelHandle);
    if (!cell || cell.outputsViewModels.length === 0 || !notebookModel) {
        return;
    }
    // uri of the cell
    const notebookUri = notebookModel.uri;
    const cellUri = cell.uri;
    const cellIndex = notebookModel.cells.indexOf(cell.model);
    // get the output index
    const outputId = outputViewModel?.model.outputId;
    let outputIndex = 0;
    if (outputId !== undefined) {
        // find the output index
        outputIndex = cell.outputsViewModels.findIndex(output => {
            return output.model.outputId === outputId;
        });
    }
    // construct the URI using the cell uri and output index
    const outputCellUri = CellUri.generateCellOutputUriWithIndex(notebookUri, cellUri, outputIndex);
    const fileName = normalizeDriveLetter(basenameOrAuthority(notebookUri));
    const l = {
        value: outputCellUri,
        id: outputCellUri.toString(),
        name: localize('notebookOutputCellLabel', "{0} • Cell {1} • Output {2}", fileName, `${cellIndex + 1}`, `${outputIndex + 1}`),
        icon: mimeType === 'application/vnd.code.notebook.error' ? ThemeIcon.fromId('error') : undefined,
        kind: 'notebookOutput',
        outputIndex,
        mimeType
    };
    return l;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tDaGF0VXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci9jb250cmliL2NoYXQvbm90ZWJvb2tDaGF0VXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDL0UsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDakYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUVwRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFHNUQsTUFBTSxDQUFDLE1BQU0sa0RBQWtELEdBQUc7SUFDakUsWUFBWTtJQUNaLFdBQVc7SUFDWCxxQ0FBcUM7SUFDckMsc0NBQXNDO0lBQ3RDLCtCQUErQjtJQUMvQiwrQkFBK0I7SUFDL0Isc0NBQXNDO0lBQ3RDLCtCQUErQjtJQUMvQixXQUFXO0lBQ1gsWUFBWTtJQUNaLFdBQVc7Q0FDWCxDQUFDO0FBRUYsTUFBTSxVQUFVLGlDQUFpQyxDQUFDLGVBQXFDLEVBQUUsUUFBZ0IsRUFBRSxjQUErQjtJQUV6SSxxQkFBcUI7SUFDckIsTUFBTSx1QkFBdUIsR0FBRyxlQUFlLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQztJQUNyRSxNQUFNLGFBQWEsR0FBRyxjQUFjLENBQUMsU0FBUyxDQUFDO0lBQy9DLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxlQUFlLENBQUMsdUJBQXVCLENBQUMsQ0FBQztJQUNyRSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFDcEUsT0FBTztJQUNSLENBQUM7SUFDRCxrQkFBa0I7SUFDbEIsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQztJQUN0QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ3pCLE1BQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUUxRCx1QkFBdUI7SUFDdkIsTUFBTSxRQUFRLEdBQUcsZUFBZSxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUM7SUFDakQsSUFBSSxXQUFXLEdBQVcsQ0FBQyxDQUFDO0lBQzVCLElBQUksUUFBUSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzVCLHdCQUF3QjtRQUN4QixXQUFXLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUN2RCxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQztRQUMzQyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCx3REFBd0Q7SUFDeEQsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLDhCQUE4QixDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDaEcsTUFBTSxRQUFRLEdBQUcsb0JBQW9CLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUV4RSxNQUFNLENBQUMsR0FBaUM7UUFDdkMsS0FBSyxFQUFFLGFBQWE7UUFDcEIsRUFBRSxFQUFFLGFBQWEsQ0FBQyxRQUFRLEVBQUU7UUFDNUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSw2QkFBNkIsRUFBRSxRQUFRLEVBQUUsR0FBRyxTQUFTLEdBQUcsQ0FBQyxFQUFFLEVBQUUsR0FBRyxXQUFXLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDNUgsSUFBSSxFQUFFLFFBQVEsS0FBSyxxQ0FBcUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztRQUNoRyxJQUFJLEVBQUUsZ0JBQWdCO1FBQ3RCLFdBQVc7UUFDWCxRQUFRO0tBQ1IsQ0FBQztJQUVGLE9BQU8sQ0FBQyxDQUFDO0FBQ1YsQ0FBQyJ9