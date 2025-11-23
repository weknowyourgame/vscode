/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { localize } from '../../../../nls.js';
import { areSameExtensions } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { ToolDataSource } from '../../chat/common/languageModelToolsService.js';
import { IExtensionsWorkbenchService } from './extensions.js';
export const InstallExtensionsToolId = 'vscode_installExtensions';
export const InstallExtensionsToolData = {
    id: InstallExtensionsToolId,
    toolReferenceName: 'installExtensions',
    canBeReferencedInPrompt: true,
    displayName: localize('installExtensionsTool.displayName', 'Install Extensions'),
    modelDescription: 'This is a tool for installing extensions in Visual Studio Code. You should provide the list of extension ids to install. The identifier of an extension is \'\${ publisher }.\${ name }\' for example: \'vscode.csharp\'.',
    userDescription: localize('installExtensionsTool.userDescription', 'Tool for installing extensions'),
    source: ToolDataSource.Internal,
    inputSchema: {
        type: 'object',
        properties: {
            ids: {
                type: 'array',
                items: {
                    type: 'string',
                },
                description: 'The ids of the extensions to search for. The identifier of an extension is \'\${ publisher }.\${ name }\' for example: \'vscode.csharp\'.',
            },
        }
    }
};
let InstallExtensionsTool = class InstallExtensionsTool {
    constructor(extensionsWorkbenchService) {
        this.extensionsWorkbenchService = extensionsWorkbenchService;
    }
    async prepareToolInvocation(context, token) {
        const parameters = context.parameters;
        return {
            confirmationMessages: {
                title: localize('installExtensionsTool.confirmationTitle', 'Install Extensions'),
                message: new MarkdownString(localize('installExtensionsTool.confirmationMessage', "Review the suggested extensions and click the **Install** button for each extension you wish to add. Once you have finished installing the selected extensions, click **Continue** to proceed.")),
            },
            toolSpecificData: {
                kind: 'extensions',
                extensions: parameters.ids
            }
        };
    }
    async invoke(invocation, _countTokens, _progress, token) {
        const input = invocation.parameters;
        const installed = this.extensionsWorkbenchService.local.filter(e => input.ids.some(id => areSameExtensions({ id }, e.identifier)));
        return {
            content: [{
                    kind: 'text',
                    value: installed.length ? localize('installExtensionsTool.resultMessage', 'Following extensions are installed: {0}', installed.map(e => e.identifier.id).join(', ')) : localize('installExtensionsTool.noResultMessage', 'No extensions were installed.'),
                }]
        };
    }
};
InstallExtensionsTool = __decorate([
    __param(0, IExtensionsWorkbenchService)
], InstallExtensionsTool);
export { InstallExtensionsTool };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFsbEV4dGVuc2lvbnNUb29sLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2V4dGVuc2lvbnMvY29tbW9uL2luc3RhbGxFeHRlbnNpb25zVG9vbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRFQUE0RSxDQUFDO0FBQy9HLE9BQU8sRUFBdUksY0FBYyxFQUFnQixNQUFNLGdEQUFnRCxDQUFDO0FBQ25PLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRTlELE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFHLDBCQUEwQixDQUFDO0FBRWxFLE1BQU0sQ0FBQyxNQUFNLHlCQUF5QixHQUFjO0lBQ25ELEVBQUUsRUFBRSx1QkFBdUI7SUFDM0IsaUJBQWlCLEVBQUUsbUJBQW1CO0lBQ3RDLHVCQUF1QixFQUFFLElBQUk7SUFDN0IsV0FBVyxFQUFFLFFBQVEsQ0FBQyxtQ0FBbUMsRUFBRSxvQkFBb0IsQ0FBQztJQUNoRixnQkFBZ0IsRUFBRSwyTkFBMk47SUFDN08sZUFBZSxFQUFFLFFBQVEsQ0FBQyx1Q0FBdUMsRUFBRSxnQ0FBZ0MsQ0FBQztJQUNwRyxNQUFNLEVBQUUsY0FBYyxDQUFDLFFBQVE7SUFDL0IsV0FBVyxFQUFFO1FBQ1osSUFBSSxFQUFFLFFBQVE7UUFDZCxVQUFVLEVBQUU7WUFDWCxHQUFHLEVBQUU7Z0JBQ0osSUFBSSxFQUFFLE9BQU87Z0JBQ2IsS0FBSyxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO2lCQUNkO2dCQUNELFdBQVcsRUFBRSwySUFBMkk7YUFDeEo7U0FDRDtLQUNEO0NBQ0QsQ0FBQztBQU1LLElBQU0scUJBQXFCLEdBQTNCLE1BQU0scUJBQXFCO0lBRWpDLFlBQytDLDBCQUF1RDtRQUF2RCwrQkFBMEIsR0FBMUIsMEJBQTBCLENBQTZCO0lBQ2xHLENBQUM7SUFFTCxLQUFLLENBQUMscUJBQXFCLENBQUMsT0FBMEMsRUFBRSxLQUF3QjtRQUMvRixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBeUIsQ0FBQztRQUNyRCxPQUFPO1lBQ04sb0JBQW9CLEVBQUU7Z0JBQ3JCLEtBQUssRUFBRSxRQUFRLENBQUMseUNBQXlDLEVBQUUsb0JBQW9CLENBQUM7Z0JBQ2hGLE9BQU8sRUFBRSxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsMkNBQTJDLEVBQUUsZ01BQWdNLENBQUMsQ0FBQzthQUNwUjtZQUNELGdCQUFnQixFQUFFO2dCQUNqQixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsVUFBVSxFQUFFLFVBQVUsQ0FBQyxHQUFHO2FBQzFCO1NBQ0QsQ0FBQztJQUNILENBQUM7SUFFRCxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQTJCLEVBQUUsWUFBaUMsRUFBRSxTQUF1QixFQUFFLEtBQXdCO1FBQzdILE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxVQUF5QixDQUFDO1FBQ25ELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkksT0FBTztZQUNOLE9BQU8sRUFBRSxDQUFDO29CQUNULElBQUksRUFBRSxNQUFNO29CQUNaLEtBQUssRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMscUNBQXFDLEVBQUUseUNBQXlDLEVBQUUsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyx1Q0FBdUMsRUFBRSwrQkFBK0IsQ0FBQztpQkFDelAsQ0FBQztTQUNGLENBQUM7SUFDSCxDQUFDO0NBQ0QsQ0FBQTtBQTlCWSxxQkFBcUI7SUFHL0IsV0FBQSwyQkFBMkIsQ0FBQTtHQUhqQixxQkFBcUIsQ0E4QmpDIn0=