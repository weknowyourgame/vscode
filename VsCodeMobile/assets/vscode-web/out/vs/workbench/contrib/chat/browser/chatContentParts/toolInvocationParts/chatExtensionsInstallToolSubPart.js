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
import * as dom from '../../../../../../base/browser/dom.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { toDisposable } from '../../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../../nls.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IExtensionManagementService } from '../../../../../../platform/extensionManagement/common/extensionManagement.js';
import { areSameExtensions } from '../../../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { ChatContextKeys } from '../../../common/chatContextKeys.js';
import { IChatToolInvocation } from '../../../common/chatService.js';
import { CancelChatActionId } from '../../actions/chatExecuteActions.js';
import { AcceptToolConfirmationActionId } from '../../actions/chatToolActions.js';
import { IChatWidgetService } from '../../chat.js';
import { ChatConfirmationWidget } from '../chatConfirmationWidget.js';
import { ChatExtensionsContentPart } from '../chatExtensionsContentPart.js';
import { BaseChatToolInvocationSubPart } from './chatToolInvocationSubPart.js';
let ExtensionsInstallConfirmationWidgetSubPart = class ExtensionsInstallConfirmationWidgetSubPart extends BaseChatToolInvocationSubPart {
    get codeblocks() {
        return this._confirmWidget?.codeblocks || [];
    }
    get codeblocksPartId() {
        return this._confirmWidget?.codeblocksPartId || '<none>';
    }
    constructor(toolInvocation, context, keybindingService, contextKeyService, chatWidgetService, extensionManagementService, instantiationService) {
        super(toolInvocation);
        if (toolInvocation.toolSpecificData?.kind !== 'extensions') {
            throw new Error('Tool specific data is missing or not of kind extensions');
        }
        const extensionsContent = toolInvocation.toolSpecificData;
        this.domNode = dom.$('');
        const chatExtensionsContentPart = this._register(instantiationService.createInstance(ChatExtensionsContentPart, extensionsContent));
        this._register(chatExtensionsContentPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        dom.append(this.domNode, chatExtensionsContentPart.domNode);
        if (toolInvocation.state.get().type === 0 /* IChatToolInvocation.StateKind.WaitingForConfirmation */) {
            const allowLabel = localize('allow', "Allow");
            const allowKeybinding = keybindingService.lookupKeybinding(AcceptToolConfirmationActionId)?.getLabel();
            const allowTooltip = allowKeybinding ? `${allowLabel} (${allowKeybinding})` : allowLabel;
            const cancelLabel = localize('cancel', "Cancel");
            const cancelKeybinding = keybindingService.lookupKeybinding(CancelChatActionId)?.getLabel();
            const cancelTooltip = cancelKeybinding ? `${cancelLabel} (${cancelKeybinding})` : cancelLabel;
            const enableAllowButtonEvent = this._register(new Emitter());
            const buttons = [
                {
                    label: allowLabel,
                    data: { type: 4 /* ToolConfirmKind.UserAction */ },
                    tooltip: allowTooltip,
                    disabled: true,
                    onDidChangeDisablement: enableAllowButtonEvent.event
                },
                {
                    label: cancelLabel,
                    data: { type: 0 /* ToolConfirmKind.Denied */ },
                    isSecondary: true,
                    tooltip: cancelTooltip
                }
            ];
            const confirmWidget = this._register(instantiationService.createInstance((ChatConfirmationWidget), context, {
                title: toolInvocation.confirmationMessages?.title ?? localize('installExtensions', "Install Extensions"),
                message: toolInvocation.confirmationMessages?.message ?? localize('installExtensionsConfirmation', "Click the Install button on the extension and then press Allow when finished."),
                buttons,
            }));
            this._confirmWidget = confirmWidget;
            this._register(confirmWidget.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
            dom.append(this.domNode, confirmWidget.domNode);
            this._register(confirmWidget.onDidClick(button => {
                IChatToolInvocation.confirmWith(toolInvocation, button.data);
                chatWidgetService.getWidgetBySessionResource(context.element.sessionResource)?.focusInput();
            }));
            const hasToolConfirmationKey = ChatContextKeys.Editing.hasToolConfirmation.bindTo(contextKeyService);
            hasToolConfirmationKey.set(true);
            this._register(toDisposable(() => hasToolConfirmationKey.reset()));
            const disposable = this._register(extensionManagementService.onInstallExtension(e => {
                if (extensionsContent.extensions.some(id => areSameExtensions({ id }, e.identifier))) {
                    disposable.dispose();
                    enableAllowButtonEvent.fire(false);
                }
            }));
        }
    }
};
ExtensionsInstallConfirmationWidgetSubPart = __decorate([
    __param(2, IKeybindingService),
    __param(3, IContextKeyService),
    __param(4, IChatWidgetService),
    __param(5, IExtensionManagementService),
    __param(6, IInstantiationService)
], ExtensionsInstallConfirmationWidgetSubPart);
export { ExtensionsInstallConfirmationWidgetSubPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEV4dGVuc2lvbnNJbnN0YWxsVG9vbFN1YlBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvdG9vbEludm9jYXRpb25QYXJ0cy9jaGF0RXh0ZW5zaW9uc0luc3RhbGxUb29sU3ViUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLHVDQUF1QyxDQUFDO0FBQzdELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDhFQUE4RSxDQUFDO0FBQzNILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGtGQUFrRixDQUFDO0FBQ3JILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNyRSxPQUFPLEVBQW1CLG1CQUFtQixFQUFtQixNQUFNLGdDQUFnQyxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNuRCxPQUFPLEVBQUUsc0JBQXNCLEVBQTJCLE1BQU0sOEJBQThCLENBQUM7QUFFL0YsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFeEUsSUFBTSwwQ0FBMEMsR0FBaEQsTUFBTSwwQ0FBMkMsU0FBUSw2QkFBNkI7SUFJNUYsSUFBVyxVQUFVO1FBQ3BCLE9BQU8sSUFBSSxDQUFDLGNBQWMsRUFBRSxVQUFVLElBQUksRUFBRSxDQUFDO0lBQzlDLENBQUM7SUFFRCxJQUFvQixnQkFBZ0I7UUFDbkMsT0FBTyxJQUFJLENBQUMsY0FBYyxFQUFFLGdCQUFnQixJQUFJLFFBQVEsQ0FBQztJQUMxRCxDQUFDO0lBRUQsWUFDQyxjQUFtQyxFQUNuQyxPQUFzQyxFQUNsQixpQkFBcUMsRUFDckMsaUJBQXFDLEVBQ3JDLGlCQUFxQyxFQUM1QiwwQkFBdUQsRUFDN0Qsb0JBQTJDO1FBRWxFLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUV0QixJQUFJLGNBQWMsQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLEtBQUssWUFBWSxFQUFFLENBQUM7WUFDNUQsTUFBTSxJQUFJLEtBQUssQ0FBQyx5REFBeUQsQ0FBQyxDQUFDO1FBQzVFLENBQUM7UUFFRCxNQUFNLGlCQUFpQixHQUFHLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztRQUMxRCxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekIsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyx5QkFBeUIsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7UUFDcEksSUFBSSxDQUFDLFNBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2xHLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU1RCxJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxpRUFBeUQsRUFBRSxDQUFDO1lBQzlGLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDOUMsTUFBTSxlQUFlLEdBQUcsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsOEJBQThCLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQztZQUN2RyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsQ0FBQyxDQUFDLEdBQUcsVUFBVSxLQUFLLGVBQWUsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUM7WUFFekYsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNqRCxNQUFNLGdCQUFnQixHQUFHLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUM7WUFDNUYsTUFBTSxhQUFhLEdBQUcsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxLQUFLLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztZQUM5RixNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVcsQ0FBQyxDQUFDO1lBRXRFLE1BQU0sT0FBTyxHQUErQztnQkFDM0Q7b0JBQ0MsS0FBSyxFQUFFLFVBQVU7b0JBQ2pCLElBQUksRUFBRSxFQUFFLElBQUksb0NBQTRCLEVBQUU7b0JBQzFDLE9BQU8sRUFBRSxZQUFZO29CQUNyQixRQUFRLEVBQUUsSUFBSTtvQkFDZCxzQkFBc0IsRUFBRSxzQkFBc0IsQ0FBQyxLQUFLO2lCQUNwRDtnQkFDRDtvQkFDQyxLQUFLLEVBQUUsV0FBVztvQkFDbEIsSUFBSSxFQUFFLEVBQUUsSUFBSSxnQ0FBd0IsRUFBRTtvQkFDdEMsV0FBVyxFQUFFLElBQUk7b0JBQ2pCLE9BQU8sRUFBRSxhQUFhO2lCQUN0QjthQUNELENBQUM7WUFFRixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FDdkUsQ0FBQSxzQkFBdUMsQ0FBQSxFQUN2QyxPQUFPLEVBQ1A7Z0JBQ0MsS0FBSyxFQUFFLGNBQWMsQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLElBQUksUUFBUSxDQUFDLG1CQUFtQixFQUFFLG9CQUFvQixDQUFDO2dCQUN4RyxPQUFPLEVBQUUsY0FBYyxDQUFDLG9CQUFvQixFQUFFLE9BQU8sSUFBSSxRQUFRLENBQUMsK0JBQStCLEVBQUUsK0VBQStFLENBQUM7Z0JBQ25MLE9BQU87YUFDUCxDQUNELENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxjQUFjLEdBQUcsYUFBYSxDQUFDO1lBQ3BDLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdEYsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNoRCxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ2hELG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM3RCxpQkFBaUIsQ0FBQywwQkFBMEIsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDO1lBQzdGLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDSixNQUFNLHNCQUFzQixHQUFHLGVBQWUsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDckcsc0JBQXNCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pDLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxDQUFDLHNCQUFzQixDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNuRSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLDBCQUEwQixDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUNuRixJQUFJLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ3RGLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDckIsc0JBQXNCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNwQyxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7SUFFRixDQUFDO0NBQ0QsQ0FBQTtBQXZGWSwwQ0FBMEM7SUFlcEQsV0FBQSxrQkFBa0IsQ0FBQTtJQUNsQixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsa0JBQWtCLENBQUE7SUFDbEIsV0FBQSwyQkFBMkIsQ0FBQTtJQUMzQixXQUFBLHFCQUFxQixDQUFBO0dBbkJYLDBDQUEwQyxDQXVGdEQifQ==