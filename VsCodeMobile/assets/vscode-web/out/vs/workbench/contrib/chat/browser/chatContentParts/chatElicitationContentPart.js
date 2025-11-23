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
import { isMarkdownString, MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun } from '../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { IChatAccessibilityService } from '../chat.js';
import { AcceptElicitationRequestActionId } from '../actions/chatElicitationActions.js';
import { ChatConfirmationWidget } from './chatConfirmationWidget.js';
let ChatElicitationContentPart = class ChatElicitationContentPart extends Disposable {
    get codeblocks() {
        return this._confirmWidget.codeblocks;
    }
    get codeblocksPartId() {
        return this._confirmWidget.codeblocksPartId;
    }
    constructor(elicitation, context, instantiationService, chatAccessibilityService, contextKeyService, keybindingService) {
        super();
        this.elicitation = elicitation;
        this.instantiationService = instantiationService;
        this.chatAccessibilityService = chatAccessibilityService;
        this.contextKeyService = contextKeyService;
        this.keybindingService = keybindingService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        const buttons = [];
        if (elicitation.kind === 'elicitation2') {
            const acceptKeybinding = this.keybindingService.lookupKeybinding(AcceptElicitationRequestActionId);
            const acceptTooltip = acceptKeybinding ? `${elicitation.acceptButtonLabel} (${acceptKeybinding.getLabel()})` : elicitation.acceptButtonLabel;
            buttons.push({
                label: elicitation.acceptButtonLabel,
                tooltip: acceptTooltip,
                data: true,
                moreActions: elicitation.moreActions?.map((action) => ({
                    label: action.label,
                    data: action,
                    run: action.run
                }))
            });
            if (elicitation.rejectButtonLabel && elicitation.reject) {
                buttons.push({ label: elicitation.rejectButtonLabel, data: false, isSecondary: true });
            }
            this._register(autorun(reader => {
                if (elicitation.isHidden?.read(reader)) {
                    this.domNode.remove();
                }
            }));
            const hasElicitationKey = ChatContextKeys.Editing.hasElicitationRequest.bindTo(this.contextKeyService);
            this._register(autorun(reader => {
                hasElicitationKey.set(elicitation.state.read(reader) === "pending" /* ElicitationState.Pending */);
            }));
            this._register(toDisposable(() => hasElicitationKey.reset()));
            this.chatAccessibilityService.acceptElicitation(elicitation);
        }
        const confirmationWidget = this._register(this.instantiationService.createInstance(ChatConfirmationWidget, context, {
            title: elicitation.title,
            subtitle: elicitation.subtitle,
            buttons,
            message: this.getMessageToRender(elicitation),
            toolbarData: { partType: 'elicitation', partSource: elicitation.source?.type, arg: elicitation },
        }));
        this._confirmWidget = confirmationWidget;
        confirmationWidget.setShowButtons(elicitation.kind === 'elicitation2' && elicitation.state.get() === "pending" /* ElicitationState.Pending */);
        this._register(confirmationWidget.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        this._register(confirmationWidget.onDidClick(async (e) => {
            if (elicitation.kind !== 'elicitation2') {
                return;
            }
            let result;
            if (typeof e.data === 'boolean' && e.data === true) {
                result = e.data;
            }
            else if (e.data && typeof e.data === 'object' && 'run' in e.data && 'label' in e.data) {
                result = e.data;
            }
            else {
                result = undefined;
            }
            if (result !== undefined) {
                await elicitation.accept(result);
            }
            else if (elicitation.reject) {
                await elicitation.reject();
            }
            confirmationWidget.setShowButtons(false);
            confirmationWidget.updateMessage(this.getMessageToRender(elicitation));
            this._onDidChangeHeight.fire();
        }));
        this.domNode = confirmationWidget.domNode;
        this.domNode.tabIndex = 0;
        const messageToRender = this.getMessageToRender(elicitation);
        this.domNode.ariaLabel = elicitation.title + ' ' + (typeof messageToRender === 'string' ? messageToRender : messageToRender.value || '');
    }
    getMessageToRender(elicitation) {
        if (!elicitation.acceptedResult) {
            return elicitation.message;
        }
        const messageMd = isMarkdownString(elicitation.message) ? MarkdownString.lift(elicitation.message) : new MarkdownString(elicitation.message);
        messageMd.appendCodeblock('json', JSON.stringify(elicitation.acceptedResult, null, 2));
        return messageMd;
    }
    hasSameContent(other) {
        // No other change allowed for this content type
        return other === this.elicitation;
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatElicitationContentPart = __decorate([
    __param(2, IInstantiationService),
    __param(3, IChatAccessibilityService),
    __param(4, IContextKeyService),
    __param(5, IKeybindingService)
], ChatElicitationContentPart);
export { ChatElicitationContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVsaWNpdGF0aW9uQ29udGVudFBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvY2hhdEVsaWNpdGF0aW9uQ29udGVudFBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBbUIsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDOUcsT0FBTyxFQUFFLFVBQVUsRUFBZSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0YsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFFN0YsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUN2RCxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN4RixPQUFPLEVBQUUsc0JBQXNCLEVBQTJCLE1BQU0sNkJBQTZCLENBQUM7QUFJdkYsSUFBTSwwQkFBMEIsR0FBaEMsTUFBTSwwQkFBMkIsU0FBUSxVQUFVO0lBUXpELElBQVcsVUFBVTtRQUNwQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxJQUFXLGdCQUFnQjtRQUMxQixPQUFPLElBQUksQ0FBQyxj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