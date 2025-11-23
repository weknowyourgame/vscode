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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IChatContextService } from './chatContextService.js';
import { isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
const extensionPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'chatContext',
    jsonSchema: {
        description: localize('chatContextExtPoint', 'Contributes chat context integrations to the chat widget.'),
        type: 'array',
        items: {
            type: 'object',
            properties: {
                id: {
                    description: localize('chatContextExtPoint.id', 'A unique identifier for this item.'),
                    type: 'string',
                },
                icon: {
                    description: localize('chatContextExtPoint.icon', 'The icon associated with this chat context item.'),
                    type: 'string'
                },
                displayName: {
                    description: localize('chatContextExtPoint.title', 'A user-friendly name for this item which is used for display in menus.'),
                    type: 'string'
                }
            },
            required: ['id', 'icon', 'displayName'],
        }
    }
});
let ChatContextContribution = class ChatContextContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chatContextContribution'; }
    constructor(_chatContextService) {
        super();
        this._chatContextService = _chatContextService;
        extensionPoint.setHandler(extensions => {
            for (const ext of extensions) {
                if (!isProposedApiEnabled(ext.description, 'chatContextProvider')) {
                    continue;
                }
                if (!Array.isArray(ext.value)) {
                    continue;
                }
                for (const contribution of ext.value) {
                    const icon = contribution.icon ? ThemeIcon.fromString(contribution.icon) : undefined;
                    if (!icon) {
                        continue;
                    }
                    this._chatContextService.setChatContextProvider(`${ext.description.id}-${contribution.id}`, { title: contribution.displayName, icon });
                }
            }
        });
    }
};
ChatContextContribution = __decorate([
    __param(0, IChatContextService)
], ChatContextContribution);
export { ChatContextContribution };
registerWorkbenchContribution2(ChatContextContribution.ID, ChatContextContribution, 3 /* WorkbenchPhase.AfterRestored */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvbnRleHQuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGV4dC5jb250cmlidXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUMsT0FBTyxFQUEwQiw4QkFBOEIsRUFBa0IsTUFBTSxrQ0FBa0MsQ0FBQztBQUMxSCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUM5RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQVEvRixNQUFNLGNBQWMsR0FBRyxrQkFBa0IsQ0FBQyxzQkFBc0IsQ0FBK0I7SUFDOUYsY0FBYyxFQUFFLGFBQWE7SUFDN0IsVUFBVSxFQUFFO1FBQ1gsV0FBVyxFQUFFLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSwyREFBMkQsQ0FBQztRQUN6RyxJQUFJLEVBQUUsT0FBTztRQUNiLEtBQUssRUFBRTtZQUNOLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNYLEVBQUUsRUFBRTtvQkFDSCxXQUFXLEVBQUUsUUFBUSxDQUFDLHdCQUF3QixFQUFFLG9DQUFvQyxDQUFDO29CQUNyRixJQUFJLEVBQUUsUUFBUTtpQkFDZDtnQkFDRCxJQUFJLEVBQUU7b0JBQ0wsV0FBVyxFQUFFLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxrREFBa0QsQ0FBQztvQkFDckcsSUFBSSxFQUFFLFFBQVE7aUJBQ2Q7Z0JBQ0QsV0FBVyxFQUFFO29CQUNaLFdBQVcsRUFBRSxRQUFRLENBQUMsMkJBQTJCLEVBQUUsd0VBQXdFLENBQUM7b0JBQzVILElBQUksRUFBRSxRQUFRO2lCQUNkO2FBQ0Q7WUFDRCxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLGFBQWEsQ0FBQztTQUN2QztLQUNEO0NBQ0QsQ0FBQyxDQUFDO0FBRUksSUFBTSx1QkFBdUIsR0FBN0IsTUFBTSx1QkFBd0IsU0FBUSxVQUFVO2FBQy9CLE9BQUUsR0FBRywyQ0FBMkMsQUFBOUMsQ0FBK0M7SUFFeEUsWUFDdUMsbUJBQXdDO1FBRTlFLEtBQUssRUFBRSxDQUFDO1FBRjhCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBcUI7UUFHOUUsY0FBYyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUN0QyxLQUFLLE1BQU0sR0FBRyxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUM5QixJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxxQkFBcUIsQ0FBQyxFQUFFLENBQUM7b0JBQ25FLFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDL0IsU0FBUztnQkFDVixDQUFDO2dCQUNELEtBQUssTUFBTSxZQUFZLElBQUksR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUN0QyxNQUFNLElBQUksR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO29CQUNyRixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7d0JBQ1gsU0FBUztvQkFDVixDQUFDO29CQUVELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBQ3hJLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDOztBQXpCVyx1QkFBdUI7SUFJakMsV0FBQSxtQkFBbUIsQ0FBQTtHQUpULHVCQUF1QixDQTBCbkM7O0FBRUQsOEJBQThCLENBQUMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLHVCQUF1Qix1Q0FBK0IsQ0FBQyJ9