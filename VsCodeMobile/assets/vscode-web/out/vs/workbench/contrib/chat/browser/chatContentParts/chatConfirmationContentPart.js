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
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IChatService } from '../../common/chatService.js';
import { isResponseVM } from '../../common/chatViewModel.js';
import { IChatWidgetService } from '../chat.js';
import { SimpleChatConfirmationWidget } from './chatConfirmationWidget.js';
let ChatConfirmationContentPart = class ChatConfirmationContentPart extends Disposable {
    constructor(confirmation, context, instantiationService, chatService, chatWidgetService) {
        super();
        this.instantiationService = instantiationService;
        this.chatService = chatService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        const element = context.element;
        const buttons = confirmation.buttons
            ? confirmation.buttons.map(button => ({
                label: button,
                data: confirmation.data,
                isSecondary: button !== confirmation.buttons?.[0],
            }))
            : [
                { label: localize('accept', "Accept"), data: confirmation.data },
                { label: localize('dismiss', "Dismiss"), data: confirmation.data, isSecondary: true },
            ];
        const confirmationWidget = this._register(this.instantiationService.createInstance(SimpleChatConfirmationWidget, context, { title: confirmation.title, buttons, message: confirmation.message, silent: confirmation.isLive === false }));
        confirmationWidget.setShowButtons(!confirmation.isUsed);
        this._register(confirmationWidget.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        this._register(confirmationWidget.onDidClick(async (e) => {
            if (isResponseVM(element)) {
                const prompt = `${e.label}: "${confirmation.title}"`;
                const options = e.isSecondary ?
                    { rejectedConfirmationData: [e.data] } :
                    { acceptedConfirmationData: [e.data] };
                options.agentId = element.agent?.id;
                options.slashCommand = element.slashCommand?.name;
                options.confirmation = e.label;
                const widget = chatWidgetService.getWidgetBySessionResource(element.sessionResource);
                options.userSelectedModelId = widget?.input.currentLanguageModel;
                options.modeInfo = widget?.input.currentModeInfo;
                options.location = widget?.location;
                Object.assign(options, widget?.getModeRequestOptions());
                if (await this.chatService.sendRequest(element.sessionResource, prompt, options)) {
                    confirmation.isUsed = true;
                    confirmationWidget.setShowButtons(false);
                    this._onDidChangeHeight.fire();
                }
            }
        }));
        this.domNode = confirmationWidget.domNode;
    }
    hasSameContent(other) {
        // No other change allowed for this content type
        return other.kind === 'confirmation';
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatConfirmationContentPart = __decorate([
    __param(2, IInstantiationService),
    __param(3, IChatService),
    __param(4, IChatWidgetService)
], ChatConfirmationContentPart);
export { ChatConfirmationContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvbmZpcm1hdGlvbkNvbnRlbnRQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL2NoYXRDb25maXJtYXRpb25Db250ZW50UGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVBQThDLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUM3RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDaEQsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFHcEUsSUFBTSwyQkFBMkIsR0FBakMsTUFBTSwyQkFBNEIsU0FBUSxVQUFVO0lBTTFELFlBQ0MsWUFBK0IsRUFDL0IsT0FBc0MsRUFDZixvQkFBNEQsRUFDckUsV0FBMEMsRUFDcEMsaUJBQXFDO1FBRXpELEtBQUssRUFBRSxDQUFDO1FBSmdDLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFDcEQsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUFQeEMsdUJBQWtCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDMUQsc0JBQWlCLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQztRQVdq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