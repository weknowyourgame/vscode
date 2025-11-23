/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../nls.js';
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2 } from '../../../../platform/actions/common/actions.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
export class OpenWebviewDeveloperToolsAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.webview.openDeveloperTools',
            title: nls.localize2('openToolsLabel', "Open Webview Developer Tools"),
            category: Categories.Developer,
            metadata: {
                description: nls.localize('openToolsDescription', "Opens Developer Tools for active webviews")
            },
            f1: true
        });
    }
    async run(accessor) {
        const nativeHostService = accessor.get(INativeHostService);
        // eslint-disable-next-line no-restricted-syntax
        const iframeWebviewElements = getActiveWindow().document.querySelectorAll('iframe.webview.ready');
        if (iframeWebviewElements.length) {
            console.info(nls.localize('iframeWebviewAlert', "Using standard dev tools to debug iframe based webview"));
            nativeHostService.openDevTools();
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vidmlld0NvbW1hbmRzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3dlYnZpZXcvZWxlY3Ryb24tYnJvd3Nlci93ZWJ2aWV3Q29tbWFuZHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUV6RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUVsRixNQUFNLE9BQU8sK0JBQWdDLFNBQVEsT0FBTztJQUUzRDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSw2Q0FBNkM7WUFDakQsS0FBSyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLEVBQUUsOEJBQThCLENBQUM7WUFDdEUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxTQUFTO1lBQzlCLFFBQVEsRUFBRTtnQkFDVCxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSwyQ0FBMkMsQ0FBQzthQUM5RjtZQUNELEVBQUUsRUFBRSxJQUFJO1NBQ1IsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEI7UUFDbkMsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFM0QsZ0RBQWdEO1FBQ2hELE1BQU0scUJBQXFCLEdBQUcsZUFBZSxFQUFFLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDbEcsSUFBSSxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNsQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsd0RBQXdELENBQUMsQ0FBQyxDQUFDO1lBQzNHLGlCQUFpQixDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2xDLENBQUM7SUFDRixDQUFDO0NBQ0QifQ==