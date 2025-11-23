/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { mockObject } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { UndoRedoGroup, UndoRedoSource } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { BulkCellEdits, ResourceNotebookCellEdit } from '../../browser/bulkCellEdits.js';
import { CellUri } from '../../../notebook/common/notebookCommon.js';
import { TestEditorService } from '../../../../test/browser/workbenchTestServices.js';
suite('BulkCellEdits', function () {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    async function runTest(inputUri, resolveUri) {
        const progress = { report: _ => { } };
        const editorService = store.add(new TestEditorService());
        const notebook = mockObject()();
        notebook.uri.returns(URI.file('/project/notebook.ipynb'));
        // eslint-disable-next-line local/code-no-any-casts
        const notebookEditorModel = mockObject()({ notebook: notebook });
        notebookEditorModel.isReadonly.returns(false);
        const notebookService = mockObject()();
        notebookService.resolve.returns({ object: notebookEditorModel, dispose: () => { } });
        const edits = [
            new ResourceNotebookCellEdit(inputUri, { index: 0, count: 1, editType: 1 /* CellEditType.Replace */, cells: [] })
        ];
        // eslint-disable-next-line local/code-no-any-casts
        const bce = new BulkCellEdits(new UndoRedoGroup(), new UndoRedoSource(), progress, CancellationToken.None, edits, editorService, notebookService);
        await bce.apply();
        const resolveArgs = notebookService.resolve.args[0];
        assert.strictEqual(resolveArgs[0].toString(), resolveUri.toString());
    }
    const notebookUri = URI.file('/foo/bar.ipynb');
    test('works with notebook URI', async () => {
        await runTest(notebookUri, notebookUri);
    });
    test('maps cell URI to notebook URI', async () => {
        await runTest(CellUri.generate(notebookUri, 5), notebookUri);
    });
    test('throws for invalid cell URI', async () => {
        const badCellUri = CellUri.generate(notebookUri, 5).with({ fragment: '' });
        await assert.rejects(async () => await runTest(badCellUri, notebookUri));
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVsa0NlbGxFZGl0cy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2J1bGtFZGl0L3Rlc3QvYnJvd3Nlci9idWxrQ2VsbEVkaXRzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxjQUFjLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNwRyxPQUFPLEVBQUUsYUFBYSxFQUFFLHdCQUF3QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFekYsT0FBTyxFQUFnQixPQUFPLEVBQWdDLE1BQU0sNENBQTRDLENBQUM7QUFFakgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFdEYsS0FBSyxDQUFDLGVBQWUsRUFBRTtJQUN0QixNQUFNLEtBQUssR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBRXhELEtBQUssVUFBVSxPQUFPLENBQUMsUUFBYSxFQUFFLFVBQWU7UUFDcEQsTUFBTSxRQUFRLEdBQW9CLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDdkQsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUV6RCxNQUFNLFFBQVEsR0FBRyxVQUFVLEVBQXFCLEVBQUUsQ0FBQztRQUNuRCxRQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQztRQUUxRCxtREFBbUQ7UUFDbkQsTUFBTSxtQkFBbUIsR0FBRyxVQUFVLEVBQWdDLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBZSxFQUFFLENBQUMsQ0FBQztRQUN0RyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTlDLE1BQU0sZUFBZSxHQUFHLFVBQVUsRUFBdUMsRUFBRSxDQUFDO1FBQzVFLGVBQWUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsTUFBTSxFQUFFLG1CQUFtQixFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRXJGLE1BQU0sS0FBSyxHQUFHO1lBQ2IsSUFBSSx3QkFBd0IsQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSw4QkFBc0IsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUM7U0FDekcsQ0FBQztRQUNGLG1EQUFtRDtRQUNuRCxNQUFNLEdBQUcsR0FBRyxJQUFJLGFBQWEsQ0FBQyxJQUFJLGFBQWEsRUFBRSxFQUFFLElBQUksY0FBYyxFQUFFLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLGVBQXNCLENBQUMsQ0FBQztRQUN6SixNQUFNLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUVsQixNQUFNLFdBQVcsR0FBRyxlQUFlLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRCxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxVQUFVLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQy9DLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMxQyxNQUFNLE9BQU8sQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDekMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsK0JBQStCLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDaEQsTUFBTSxPQUFPLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDOUQsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsNkJBQTZCLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDOUMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDM0UsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsTUFBTSxPQUFPLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDMUUsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9