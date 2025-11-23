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
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { checkProposedApiEnabled } from '../../../../services/extensions/common/extensions.js';
import * as extensionsRegistry from '../../../../services/extensions/common/extensionsRegistry.js';
const chatViewsWelcomeJsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['icon', 'title', 'contents', 'when'],
    properties: {
        icon: {
            type: 'string',
            description: localize('chatViewsWelcome.icon', 'The icon for the welcome message.'),
        },
        title: {
            type: 'string',
            description: localize('chatViewsWelcome.title', 'The title of the welcome message.'),
        },
        content: {
            type: 'string',
            description: localize('chatViewsWelcome.content', 'The content of the welcome message. The first command link will be rendered as a button.'),
        },
        when: {
            type: 'string',
            description: localize('chatViewsWelcome.when', 'Condition when the welcome message is shown.'),
        }
    }
};
const chatViewsWelcomeExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'chatViewsWelcome',
    jsonSchema: {
        description: localize('vscode.extension.contributes.chatViewsWelcome', 'Contributes a welcome message to a chat view'),
        type: 'array',
        items: chatViewsWelcomeJsonSchema,
    },
});
let ChatViewsWelcomeHandler = class ChatViewsWelcomeHandler {
    static { this.ID = 'workbench.contrib.chatViewsWelcomeHandler'; }
    constructor(logService) {
        this.logService = logService;
        chatViewsWelcomeExtensionPoint.setHandler((extensions, delta) => {
            for (const extension of delta.added) {
                for (const providerDescriptor of extension.value) {
                    checkProposedApiEnabled(extension.description, 'chatParticipantPrivate');
                    const when = ContextKeyExpr.deserialize(providerDescriptor.when);
                    if (!when) {
                        this.logService.error(`Could not deserialize 'when' clause for chatViewsWelcome contribution: ${providerDescriptor.when}`);
                        continue;
                    }
                    const descriptor = {
                        ...providerDescriptor,
                        when,
                        icon: ThemeIcon.fromString(providerDescriptor.icon),
                        content: new MarkdownString(providerDescriptor.content, { isTrusted: true }), // private API with command links
                    };
                    Registry.as("workbench.registry.chat.viewsWelcome" /* ChatViewsWelcomeExtensions.ChatViewsWelcomeRegistry */).register(descriptor);
                }
            }
        });
    }
};
ChatViewsWelcomeHandler = __decorate([
    __param(0, ILogService)
], ChatViewsWelcomeHandler);
export { ChatViewsWelcomeHandler };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFZpZXdzV2VsY29tZUhhbmRsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL3ZpZXdzV2VsY29tZS9jaGF0Vmlld3NXZWxjb21lSGFuZGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFM0UsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDekYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUUvRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMvRixPQUFPLEtBQUssa0JBQWtCLE1BQU0sOERBQThELENBQUM7QUFJbkcsTUFBTSwwQkFBMEIsR0FBRztJQUNsQyxJQUFJLEVBQUUsUUFBUTtJQUNkLG9CQUFvQixFQUFFLEtBQUs7SUFDM0IsUUFBUSxFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDO0lBQy9DLFVBQVUsRUFBRTtRQUNYLElBQUksRUFBRTtZQUNMLElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxtQ0FBbUMsQ0FBQztTQUNuRjtRQUNELEtBQUssRUFBRTtZQUNOLElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLFFBQVEsQ0FBQyx3QkFBd0IsRUFBRSxtQ0FBbUMsQ0FBQztTQUNwRjtRQUNELE9BQU8sRUFBRTtZQUNSLElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSwwRkFBMEYsQ0FBQztTQUM3STtRQUNELElBQUksRUFBRTtZQUNMLElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSw4Q0FBOEMsQ0FBQztTQUM5RjtLQUNEO0NBQzhCLENBQUM7QUFJakMsTUFBTSw4QkFBOEIsR0FBRyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxzQkFBc0IsQ0FBcUM7SUFDdkksY0FBYyxFQUFFLGtCQUFrQjtJQUNsQyxVQUFVLEVBQUU7UUFDWCxXQUFXLEVBQUUsUUFBUSxDQUFDLCtDQUErQyxFQUFFLDhDQUE4QyxDQUFDO1FBQ3RILElBQUksRUFBRSxPQUFPO1FBQ2IsS0FBSyxFQUFFLDBCQUEwQjtLQUNqQztDQUNELENBQUMsQ0FBQztBQUVJLElBQU0sdUJBQXVCLEdBQTdCLE1BQU0sdUJBQXVCO2FBRW5CLE9BQUUsR0FBRywyQ0FBMkMsQUFBOUMsQ0FBK0M7SUFFakUsWUFDK0IsVUFBdUI7UUFBdkIsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUVyRCw4QkFBOEIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDL0QsS0FBSyxNQUFNLFNBQVMsSUFBSSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ3JDLEtBQUssTUFBTSxrQkFBa0IsSUFBSSxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ2xELHVCQUF1QixDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztvQkFFekUsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDakUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO3dCQUNYLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLDBFQUEwRSxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO3dCQUMzSCxTQUFTO29CQUNWLENBQUM7b0JBRUQsTUFBTSxVQUFVLEdBQWdDO3dCQUMvQyxHQUFHLGtCQUFrQjt3QkFDckIsSUFBSTt3QkFDSixJQUFJLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUM7d0JBQ25ELE9BQU8sRUFBRSxJQUFJLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxpQ0FBaUM7cUJBQy9HLENBQUM7b0JBQ0YsUUFBUSxDQUFDLEVBQUUsa0dBQTRGLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM5SCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQzs7QUE1QlcsdUJBQXVCO0lBS2pDLFdBQUEsV0FBVyxDQUFBO0dBTEQsdUJBQXVCLENBNkJuQyJ9