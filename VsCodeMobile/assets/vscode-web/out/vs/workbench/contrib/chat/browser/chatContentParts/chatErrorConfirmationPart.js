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
import * as dom from '../../../../../base/browser/dom.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { IChatService } from '../../common/chatService.js';
import { assertIsResponseVM } from '../../common/chatViewModel.js';
import { IChatWidgetService } from '../chat.js';
import { ChatErrorWidget } from './chatErrorContentPart.js';
const $ = dom.$;
let ChatErrorConfirmationContentPart = class ChatErrorConfirmationContentPart extends Disposable {
    constructor(kind, content, errorDetails, confirmationButtons, renderer, context, instantiationService, chatWidgetService, chatService) {
        super();
        this.errorDetails = errorDetails;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        const element = context.element;
        assertIsResponseVM(element);
        this.domNode = $('.chat-error-confirmation');
        this.domNode.append(this._register(new ChatErrorWidget(kind, content, renderer)).domNode);
        const buttonOptions = { ...defaultButtonStyles };
        const buttonContainer = dom.append(this.domNode, $('.chat-buttons-container'));
        confirmationButtons.forEach(buttonData => {
            const button = this._register(new Button(buttonContainer, buttonOptions));
            button.label = buttonData.label;
            this._register(button.onDidClick(async () => {
                const prompt = buttonData.label;
                const options = buttonData.isSecondary ?
                    { rejectedConfirmationData: [buttonData.data] } :
                    { acceptedConfirmationData: [buttonData.data] };
                options.agentId = element.agent?.id;
                options.slashCommand = element.slashCommand?.name;
                options.confirmation = buttonData.label;
                const widget = chatWidgetService.getWidgetBySessionResource(element.sessionResource);
                options.userSelectedModelId = widget?.input.currentLanguageModel;
                Object.assign(options, widget?.getModeRequestOptions());
                if (await chatService.sendRequest(element.sessionResource, prompt, options)) {
                    this._onDidChangeHeight.fire();
                }
            }));
        });
    }
    hasSameContent(other) {
        return other.kind === this.errorDetails.kind && other.isLast === this.errorDetails.isLast;
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatErrorConfirmationContentPart = __decorate([
    __param(6, IInstantiationService),
    __param(7, IChatWidgetService),
    __param(8, IChatService)
], ChatErrorConfirmationContentPart);
export { ChatErrorConfirmationContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVycm9yQ29uZmlybWF0aW9uUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0RXJyb3JDb25maXJtYXRpb25QYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLE1BQU0sRUFBa0IsTUFBTSxpREFBaUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFOUQsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLHlDQUF5QyxDQUFDO0FBRWxGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzdGLE9BQU8sRUFBd0YsWUFBWSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDakosT0FBTyxFQUFFLGtCQUFrQixFQUErQyxNQUFNLCtCQUErQixDQUFDO0FBQ2hILE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVoRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFNUQsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUVULElBQU0sZ0NBQWdDLEdBQXRDLE1BQU0sZ0NBQWlDLFNBQVEsVUFBVTtJQU0vRCxZQUNDLElBQW9CLEVBQ3BCLE9BQXdCLEVBQ1AsWUFBbUMsRUFDcEQsbUJBQWtFLEVBQ2xFLFFBQTJCLEVBQzNCLE9BQXNDLEVBQ2Ysb0JBQTJDLEVBQzlDLGlCQUFxQyxFQUMzQyxXQUF5QjtRQUV2QyxLQUFLLEVBQUUsQ0FBQztRQVJTLGlCQUFZLEdBQVosWUFBWSxDQUF1QjtRQU5wQyx1QkFBa0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUMxRCxzQkFBaUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDO1FBZWpFLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDaEMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksZUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUUxRixNQUFNLGFBQWEsR0FBbUIsRUFBRSxHQUFHLG1CQUFtQixFQUFFLENBQUM7UUFFakUsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7UUFDL0UsbUJBQW1CLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3hDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxNQUFNLENBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7WUFDMUUsTUFBTSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDO1lBRWhDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxLQUFLLElBQUksRUFBRTtnQkFDM0MsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQztnQkFDaEMsTUFBTSxPQUFPLEdBQTRCLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztvQkFDaEUsRUFBRSx3QkFBd0IsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQ2pELEVBQUUsd0JBQXdCLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDakQsT0FBTyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQztnQkFDcEMsT0FBTyxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQztnQkFDbEQsT0FBTyxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDO2dCQUN4QyxNQUFNLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQywwQkFBMEIsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQ3JGLE9BQU8sQ0FBQyxtQkFBbUIsR0FBRyxNQUFNLEVBQUUsS0FBSyxDQUFDLG9CQUFvQixDQUFDO2dCQUNqRSxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLE1BQU0sV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsRUFBRSxDQUFDO29CQUM3RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2hDLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsY0FBYyxDQUFDLEtBQTJCO1FBQ3pDLE9BQU8sS0FBSyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDO0lBQzNGLENBQUM7SUFFRCxhQUFhLENBQUMsVUFBdUI7UUFDcEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM1QixDQUFDO0NBQ0QsQ0FBQTtBQXpEWSxnQ0FBZ0M7SUFhMUMsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsWUFBWSxDQUFBO0dBZkYsZ0NBQWdDLENBeUQ1QyJ9