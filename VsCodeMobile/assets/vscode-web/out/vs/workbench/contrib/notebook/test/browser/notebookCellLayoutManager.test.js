/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NotebookCellLayoutManager } from '../../browser/notebookCellLayoutManager.js';
suite('NotebookCellLayoutManager', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    const mockCellViewModel = () => {
        return { handle: 'cell1' };
    };
    class MockList {
        constructor() {
            this._height = new Map();
            this.inRenderingTransaction = false;
            this.getViewIndexCalled = false;
            this.cells = [];
        }
        getViewIndex(cell) { return this.cells.indexOf(cell) < 0 ? undefined : this.cells.indexOf(cell); }
        elementHeight(cell) { return this._height.get(cell) ?? 100; }
        updateElementHeight2(cell, height) { this._height.set(cell, height); }
    }
    class MockLoggingService {
        debug() { }
        info() { }
        warn() { }
        error() { }
        trace() { }
    }
    class MockNotebookWidget {
        constructor() {
            this.viewModel = {
                hasCell: (cell) => true,
                getCellIndex: () => 0
            };
            this.visibleRanges = [{ start: 0, end: 0 }];
        }
        hasEditorFocus() { return true; }
        getAbsoluteTopOfElement() { return 0; }
        getLength() { return 1; }
        getDomNode() {
            return {
                style: {
                    height: '100px'
                }
            };
        }
    }
    test('should update cell height', async () => {
        const cell = mockCellViewModel();
        const cell2 = mockCellViewModel();
        const list = new MockList();
        list.cells.push(cell);
        list.cells.push(cell2);
        const widget = new MockNotebookWidget();
        const mgr = store.add(new NotebookCellLayoutManager(widget, list, new MockLoggingService()));
        mgr.layoutNotebookCell(cell, 200);
        mgr.layoutNotebookCell(cell2, 200);
        assert.strictEqual(list.elementHeight(cell), 200);
        assert.strictEqual(list.elementHeight(cell2), 200);
    });
    test('should schedule updates if already in a rendering transaction', async () => {
        const cell = mockCellViewModel();
        const cell2 = mockCellViewModel();
        const list = new MockList();
        list.inRenderingTransaction = true;
        list.cells.push(cell);
        list.cells.push(cell2);
        const widget = new MockNotebookWidget();
        const mgr = store.add(new NotebookCellLayoutManager(widget, list, new MockLoggingService()));
        const promise = mgr.layoutNotebookCell(cell, 200);
        mgr.layoutNotebookCell(cell2, 200);
        assert.strictEqual(list.elementHeight(cell), 100);
        assert.strictEqual(list.elementHeight(cell2), 100);
        list.inRenderingTransaction = false;
        await promise;
        assert.strictEqual(list.elementHeight(cell), 200);
        assert.strictEqual(list.elementHeight(cell2), 200);
    });
    test('should not update if cell is hidden', async () => {
        const cell = mockCellViewModel();
        const list = new MockList();
        const widget = new MockNotebookWidget();
        const mgr = store.add(new NotebookCellLayoutManager(widget, list, new MockLoggingService()));
        await mgr.layoutNotebookCell(cell, 200);
        assert.strictEqual(list.elementHeight(cell), 100);
    });
    test('should not update if height is unchanged', async () => {
        const cell = mockCellViewModel();
        const list = new MockList();
        list.cells.push(cell);
        const widget = new MockNotebookWidget();
        const mgr = store.add(new NotebookCellLayoutManager(widget, list, new MockLoggingService()));
        await mgr.layoutNotebookCell(cell, 100);
        assert.strictEqual(list.elementHeight(cell), 100);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tDZWxsTGF5b3V0TWFuYWdlci50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL3Rlc3QvYnJvd3Nlci9ub3RlYm9va0NlbGxMYXlvdXRNYW5hZ2VyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDakMsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFbkcsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFPdkYsS0FBSyxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRTtJQUV2QyxNQUFNLEtBQUssR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBRXhELE1BQU0saUJBQWlCLEdBQUcsR0FBRyxFQUFFO1FBQzlCLE9BQU8sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUErQixDQUFDO0lBQ3pELENBQUMsQ0FBQztJQUVGLE1BQU0sUUFBUTtRQUFkO1lBQ1MsWUFBTyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7WUFHNUIsMkJBQXNCLEdBQUcsS0FBSyxDQUFDO1lBRS9CLHVCQUFrQixHQUFHLEtBQUssQ0FBQztZQUMzQixVQUFLLEdBQXFCLEVBQUUsQ0FBQztRQUM5QixDQUFDO1FBTkEsWUFBWSxDQUFDLElBQW9CLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xILGFBQWEsQ0FBQyxJQUFvQixJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFH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