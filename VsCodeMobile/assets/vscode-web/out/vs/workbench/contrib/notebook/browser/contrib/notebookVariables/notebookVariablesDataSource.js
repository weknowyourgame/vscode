/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationTokenSource } from '../../../../../../base/common/cancellation.js';
import { localize } from '../../../../../../nls.js';
import { variablePageSize } from '../../../common/notebookKernelService.js';
export class NotebookVariableDataSource {
    constructor(notebookKernelService) {
        this.notebookKernelService = notebookKernelService;
        this.cancellationTokenSource = new CancellationTokenSource();
    }
    hasChildren(element) {
        return element.kind === 'root' || element.hasNamedChildren || element.indexedChildrenCount > 0;
    }
    cancel() {
        this.cancellationTokenSource.cancel();
        this.cancellationTokenSource.dispose();
        this.cancellationTokenSource = new CancellationTokenSource();
    }
    async getChildren(element) {
        if (element.kind === 'empty') {
            return [];
        }
        else if (element.kind === 'root') {
            return this.getRootVariables(element.notebook);
        }
        else {
            return this.getVariables(element);
        }
    }
    async getVariables(parent) {
        const selectedKernel = this.notebookKernelService.getMatchingKernel(parent.notebook).selected;
        if (selectedKernel && selectedKernel.hasVariableProvider) {
            let children = [];
            if (parent.hasNamedChildren) {
                const variables = selectedKernel.provideVariables(parent.notebook.uri, parent.extHostId, 'named', 0, this.cancellationTokenSource.token);
                for await (const variable of variables) {
                    children.push(this.createVariableElement(variable, parent.notebook));
                }
            }
            if (parent.indexedChildrenCount > 0) {
                const childNodes = await this.getIndexedChildren(parent, selectedKernel);
                children = children.concat(childNodes);
            }
            return children;
        }
        return [];
    }
    async getIndexedChildren(parent, kernel) {
        const childNodes = [];
        if (parent.indexedChildrenCount > variablePageSize) {
            const nestedPageSize = Math.floor(Math.max(parent.indexedChildrenCount / variablePageSize, 100));
            const indexedChildCountLimit = 1_000_000;
            let start = parent.indexStart ?? 0;
            const last = start + Math.min(parent.indexedChildrenCount, indexedChildCountLimit);
            for (; start < last; start += nestedPageSize) {
                let end = start + nestedPageSize;
                if (end > last) {
                    end = last;
                }
                childNodes.push({
                    kind: 'variable',
                    notebook: parent.notebook,
                    id: parent.id + `${start}`,
                    extHostId: parent.extHostId,
                    name: `[${start}..${end - 1}]`,
                    value: '',
                    indexedChildrenCount: end - start,
                    indexStart: start,
                    hasNamedChildren: false
                });
            }
            if (parent.indexedChildrenCount > indexedChildCountLimit) {
                childNodes.push({
                    kind: 'variable',
                    notebook: parent.notebook,
                    id: parent.id + `${last + 1}`,
                    extHostId: parent.extHostId,
                    name: localize('notebook.indexedChildrenLimitReached', "Display limit reached"),
                    value: '',
                    indexedChildrenCount: 0,
                    hasNamedChildren: false
                });
            }
        }
        else if (parent.indexedChildrenCount > 0) {
            const variables = kernel.provideVariables(parent.notebook.uri, parent.extHostId, 'indexed', parent.indexStart ?? 0, this.cancellationTokenSource.token);
            for await (const variable of variables) {
                childNodes.push(this.createVariableElement(variable, parent.notebook));
                if (childNodes.length >= variablePageSize) {
                    break;
                }
            }
        }
        return childNodes;
    }
    async getRootVariables(notebook) {
        const selectedKernel = this.notebookKernelService.getMatchingKernel(notebook).selected;
        if (selectedKernel && selectedKernel.hasVariableProvider) {
            const variables = selectedKernel.provideVariables(notebook.uri, undefined, 'named', 0, this.cancellationTokenSource.token);
            const varElements = [];
            for await (const variable of variables) {
                varElements.push(this.createVariableElement(variable, notebook));
            }
            return varElements;
        }
        return [];
    }
    createVariableElement(variable, notebook) {
        return {
            ...variable,
            kind: 'variable',
            notebook,
            extHostId: variable.id,
            id: `${variable.id}`
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tWYXJpYWJsZXNEYXRhU291cmNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvY29udHJpYi9ub3RlYm9va1ZhcmlhYmxlcy9ub3RlYm9va1ZhcmlhYmxlc0RhdGFTb3VyY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDeEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRXBELE9BQU8sRUFBNEQsZ0JBQWdCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQTRCdEksTUFBTSxPQUFPLDBCQUEwQjtJQUl0QyxZQUE2QixxQkFBNkM7UUFBN0MsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF3QjtRQUN6RSxJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSx1QkFBdUIsRUFBRSxDQUFDO0lBQzlELENBQUM7SUFFRCxXQUFXLENBQUMsT0FBa0Q7UUFDN0QsT0FBTyxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sSUFBSSxPQUFPLENBQUMsZ0JBQWdCLElBQUksT0FBTyxDQUFDLG9CQUFvQixHQUFHLENBQUMsQ0FBQztJQUNoRyxDQUFDO0lBRU0sTUFBTTtRQUNaLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUN0QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdkMsSUFBSSxDQUFDLHVCQUF1QixHQUFHLElBQUksdUJBQXVCLEVBQUUsQ0FBQztJQUM5RCxDQUFDO0lBRUQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxPQUFnRTtRQUNqRixJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDOUIsT0FBTyxFQUFFLENBQUM7UUFD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