/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestMainThreadNotebookKernels } from './TestMainThreadNotebookKernels.js';
import { mock } from '../../../test/common/workbenchTestServices.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { SingleProxyRPCProtocol } from '../common/testRPCProtocol.js';
suite('MainThreadNotebookKernelVariableProvider', function () {
    let mainThreadKernels;
    let variables;
    teardown(function () {
    });
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    setup(async function () {
        const proxy = new class extends mock() {
            async $provideVariables(handle, requestId, notebookUri, parentId, kind, start, token) {
                for (const variable of variables) {
                    if (token.isCancellationRequested) {
                        return;
                    }
                    const result = typeof variable === 'function'
                        ? await variable()
                        : variable;
                    mainThreadKernels.instance.$receiveVariable(requestId, result);
                }
            }
        };
        const extHostContext = SingleProxyRPCProtocol(proxy);
        variables = [];
        mainThreadKernels = store.add(new TestMainThreadNotebookKernels(extHostContext));
    });
    test('get variables from kernel', async function () {
        await mainThreadKernels.addKernel('test-kernel');
        const kernel = mainThreadKernels.getKernel('test-kernel');
        assert.ok(kernel, 'Kernel should be registered');
        variables.push(createVariable(1));
        variables.push(createVariable(2));
        const vars = kernel.provideVariables(URI.file('nb.ipynb'), undefined, 'named', 0, CancellationToken.None);
        await verifyVariables(vars, [1, 2]);
    });
    test('get variables twice', async function () {
        await mainThreadKernels.addKernel('test-kernel');
        const kernel = mainThreadKernels.getKernel('test-kernel');
        assert.ok(kernel, 'Kernel should be registered');
        variables.push(createVariable(1));
        variables.push(createVariable(2));
        const vars = kernel.provideVariables(URI.file('nb.ipynb'), undefined, 'named', 0, CancellationToken.None);
        const vars2 = kernel.provideVariables(URI.file('nb.ipynb'), undefined, 'named', 0, CancellationToken.None);
        await verifyVariables(vars, [1, 2]);
        await verifyVariables(vars2, [1, 2]);
    });
    test('gets all variables async', async function () {
        await mainThreadKernels.addKernel('test-kernel');
        const kernel = mainThreadKernels.getKernel('test-kernel');
        assert.ok(kernel, 'Kernel should be registered');
        variables.push(createVariable(1));
        const result = createVariable(2);
        variables.push(async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return result;
        });
        variables.push(createVariable(3));
        const vars = kernel.provideVariables(URI.file('nb.ipynb'), undefined, 'named', 0, CancellationToken.None);
        await verifyVariables(vars, [1, 2, 3]);
    });
    test('cancel while getting variables', async function () {
        await mainThreadKernels.addKernel('test-kernel');
        const kernel = mainThreadKernels.getKernel('test-kernel');
        assert.ok(kernel, 'Kernel should be registered');
        variables.push(createVariable(1));
        const result = createVariable(2);
        variables.push(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return result;
        });
        variables.push(createVariable(3));
        const cancellation = new CancellationTokenSource();
        const vars = kernel.provideVariables(URI.file('nb.ipynb'), undefined, 'named', 0, cancellation.token);
        cancellation.cancel();
        await verifyVariables(vars, [1, 2]);
    });
});
async function verifyVariables(variables, expectedIds) {
    let varIx = 0;
    for await (const variable of variables) {
        assert.ok(expectedIds[varIx], 'more variables than expected');
        assert.strictEqual(variable.id, expectedIds[varIx++]);
    }
}
function createVariable(id) {
    return {
        id,
        name: `var${id}`,
        value: `${id}`,
        type: 'number',
        expression: `var${id}`,
        hasNamedChildren: false,
        indexedChildrenCount: 0,
        extensionId: 'extension-id1',
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFZhcmlhYmxlUHJvdmlkZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9tYWluVGhyZWFkVmFyaWFibGVQcm92aWRlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUVuRixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDckUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQU10RSxLQUFLLENBQUMsMENBQTBDLEVBQUU7SUFDakQsSUFBSSxpQkFBZ0QsQ0FBQztJQUNyRCxJQUFJLFNBQStDLENBQUM7SUFFcEQsUUFBUSxDQUFDO0lBQ1QsQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLEtBQUssR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBRXhELEtBQUssQ0FBQyxLQUFLO1FBQ1YsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFNLFNBQVEsSUFBSSxFQUErQjtZQUN6RCxLQUFLLENBQUMsaUJBQWlCLENBQUMsTUFBYyxFQUFFLFNBQWlCLEVBQUUsV0FBMEIsRUFBRSxRQUE0QixFQUFFLElBQXlCLEVBQUUsS0FBYSxFQUFFLEtBQXdCO2dCQUMvTCxLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNsQyxJQUFJLEtBQUss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