/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { AsyncIterableProducer } from '../../../../../base/common/async.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NotebookVariableDataSource } from '../../browser/contrib/notebookVariables/notebookVariablesDataSource.js';
suite('NotebookVariableDataSource', () => {
    let dataSource;
    const notebookModel = { uri: 'one.ipynb', languages: ['python'] };
    let provideVariablesCalled;
    let results;
    const kernel = new class extends mock() {
        constructor() {
            super(...arguments);
            this.hasVariableProvider = true;
        }
        provideVariables(notebookUri, parentId, kind, start, token) {
            provideVariablesCalled = true;
            return new AsyncIterableProducer((emitter) => {
                for (let i = 0; i < results.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    if (results[i].action) {
                        results[i].action();
                    }
                    emitter.emitOne(results[i]);
                }
            });
        }
    };
    const kernelService = new class extends mock() {
        getMatchingKernel(notebook) {
            return { selected: kernel, all: [], suggestions: [], hidden: [] };
        }
    };
    ensureNoDisposablesAreLeakedInTestSuite();
    setup(() => {
        provideVariablesCalled = false;
        dataSource = new NotebookVariableDataSource(kernelService);
        results = [
            { id: 1, name: 'a', value: '1', hasNamedChildren: false, indexedChildrenCount: 0 },
        ];
    });
    test('Root element should return children', async () => {
        const variables = await dataSource.getChildren({ kind: 'root', notebook: notebookModel });
        assert.strictEqual(variables.length, 1);
    });
    test('Get children of list element', async () => {
        const parent = { kind: 'variable', notebook: notebookModel, id: '1', extHostId: 1, name: 'list', value: '[...]', hasNamedChildren: false, indexedChildrenCount: 5 };
        results = [
            { id: 2, name: 'first', value: '1', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 3, name: 'second', value: '2', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 4, name: 'third', value: '3', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 5, name: 'fourth', value: '4', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 6, name: 'fifth', value: '5', hasNamedChildren: false, indexedChildrenCount: 0 },
        ];
        const variables = await dataSource.getChildren(parent);
        assert.strictEqual(variables.length, 5);
    });
    test('Get children for large list', async () => {
        const parent = { kind: 'variable', notebook: notebookModel, id: '1', extHostId: 1, name: 'list', value: '[...]', hasNamedChildren: false, indexedChildrenCount: 2000 };
        results = [];
        const variables = await dataSource.getChildren(parent);
        assert(variables.length > 1, 'We should have results for groups of children');
        assert(!provideVariablesCalled, 'provideVariables should not be called');
        assert.equal(variables[0].extHostId, parent.extHostId, 'ExtHostId should match the parent since we will use it to get the real children');
    });
    test('Get children for very large list', async () => {
        const parent = { kind: 'variable', notebook: notebookModel, id: '1', extHostId: 1, name: 'list', value: '[...]', hasNamedChildren: false, indexedChildrenCount: 1_000_000 };
        results = [];
        const groups = await dataSource.getChildren(parent);
        const children = await dataSource.getChildren(groups[99]);
        assert(children.length === 100, 'We should have a full page of child groups');
        assert(!provideVariablesCalled, 'provideVariables should not be called');
        assert.equal(children[0].extHostId, parent.extHostId, 'ExtHostId should match the parent since we will use it to get the real children');
    });
    test('Cancel while enumerating through children', async () => {
        const parent = { kind: 'variable', notebook: notebookModel, id: '1', extHostId: 1, name: 'list', value: '[...]', hasNamedChildren: false, indexedChildrenCount: 10 };
        results = [
            { id: 2, name: 'first', value: '1', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 3, name: 'second', value: '2', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 4, name: 'third', value: '3', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 5, name: 'fourth', value: '4', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 5, name: 'fifth', value: '4', hasNamedChildren: false, indexedChildrenCount: 0, action: () => dataSource.cancel() },
            { id: 7, name: 'sixth', value: '6', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 8, name: 'seventh', value: '7', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 9, name: 'eighth', value: '8', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 10, name: 'ninth', value: '9', hasNamedChildren: false, indexedChildrenCount: 0 },
            { id: 11, name: 'tenth', value: '10', hasNamedChildren: false, indexedChildrenCount: 0 },
        ];
        const variables = await dataSource.getChildren(parent);
        assert.equal(variables.length, 5, 'Iterating should have been cancelled');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tWYXJpYWJsZXNEYXRhU291cmNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svdGVzdC9icm93c2VyL25vdGVib29rVmFyaWFibGVzRGF0YVNvdXJjZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUc1RSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDL0QsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUE0QiwwQkFBMEIsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBSzlJLEtBQUssQ0FBQyw0QkFBNEIsRUFBRSxHQUFHLEVBQUU7SUFDeEMsSUFBSSxVQUFzQyxDQUFDO0lBQzNDLE1BQU0sYUFBYSxHQUFHLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBa0MsQ0FBQztJQUNsRyxJQUFJLHNCQUErQixDQUFDO0lBR3BDLElBQUksT0FBb0MsQ0FBQztJQUV6QyxNQUFNLE1BQU0sR0FBRyxJQUFJLEtBQU0sU0FBUSxJQUFJLEVBQW1CO1FBQXJDOztZQUNULHdCQUFtQixHQUFHLElBQUksQ0FBQztRQXFCckMsQ0FBQztRQXBCUyxnQkFBZ0IsQ0FDeEIsV0FBZ0IsRUFDaEIsUUFBNEIsRUFDNUIsSUFBeUIsRUFDekIsS0FBYSxFQUNiLEtBQXdCO1lBRXhCLHNCQUFzQixHQUFHLElBQUksQ0FBQztZQUM5QixPQUFPLElBQUkscUJBQXFCLENBQWtCLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQzdELEtBQUssSUFBSSxDQUFDLEdBQUcs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