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
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { assertType } from '../../../../../base/common/types.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { asCssVariable, textLinkForeground } from '../../../../../platform/theme/common/colorRegistry.js';
import { ChatEntitlement, IChatEntitlementService } from '../../../../services/chat/common/chatEntitlementService.js';
import { IChatWidgetService } from '../chat.js';
const $ = dom.$;
/**
 * Once the sign up button is clicked, and the retry
 * button has been shown, it should be shown every time.
 */
let shouldShowRetryButton = false;
/**
 * Once the 'retry' button is clicked, the wait warning
 * should be shown every time.
 */
let shouldShowWaitWarning = false;
let ChatQuotaExceededPart = class ChatQuotaExceededPart extends Disposable {
    constructor(element, content, renderer, chatWidgetService, commandService, telemetryService, chatEntitlementService) {
        super();
        this.content = content;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        const errorDetails = element.errorDetails;
        assertType(!!errorDetails, 'errorDetails');
        this.domNode = $('.chat-quota-error-widget');
        const icon = dom.append(this.domNode, $('span'));
        icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));
        const messageContainer = dom.append(this.domNode, $('.chat-quota-error-message'));
        const markdownContent = this._register(renderer.render(new MarkdownString(errorDetails.message)));
        dom.append(messageContainer, markdownContent.element);
        let primaryButtonLabel;
        switch (chatEntitlementService.entitlement) {
            case ChatEntitlement.Pro:
            case ChatEntitlement.ProPlus:
                primaryButtonLabel = localize('enableAdditionalUsage', "Manage Paid Premium Requests");
                break;
            case ChatEntitlement.Free:
                primaryButtonLabel = localize('upgradeToCopilotPro', "Upgrade to GitHub Copilot Pro");
                break;
        }
        let hasAddedWaitWarning = false;
        const addWaitWarningIfNeeded = () => {
            if (!shouldShowWaitWarning || hasAddedWaitWarning) {
                return;
            }
            hasAddedWaitWarning = true;
            dom.append(messageContainer, $('.chat-quota-wait-warning', undefined, localize('waitWarning', "Changes may take a few minutes to take effect.")));
        };
        let hasAddedRetryButton = false;
        const addRetryButtonIfNeeded = () => {
            if (!shouldShowRetryButton || hasAddedRetryButton) {
                return;
            }
            hasAddedRetryButton = true;
            const retryButton = this._register(new Button(messageContainer, {
                buttonBackground: undefined,
                buttonForeground: asCssVariable(textLinkForeground)
            }));
            retryButton.element.classList.add('chat-quota-error-secondary-button');
            retryButton.label = localize('clickToContinue', "Click to Retry");
            this._onDidChangeHeight.fire();
            this._register(retryButton.onDidClick(() => {
                const widget = chatWidgetService.getWidgetBySessionResource(element.sessionResource);
                if (!widget) {
                    return;
                }
                widget.rerunLastRequest();
                shouldShowWaitWarning = true;
                addWaitWarningIfNeeded();
            }));
        };
        if (primaryButtonLabel) {
            const primaryButton = this._register(new Button(messageContainer, { ...defaultButtonStyles, supportIcons: true }));
            primaryButton.label = primaryButtonLabel;
            primaryButton.element.classList.add('chat-quota-error-button');
            this._register(primaryButton.onDidClick(async () => {
                const commandId = chatEntitlementService.entitlement === ChatEntitlement.Free ? 'workbench.action.chat.upgradePlan' : 'workbench.action.chat.manageOverages';
                telemetryService.publicLog2('workbenchActionExecuted', { id: commandId, from: 'chat-response' });
                await commandService.executeCommand(commandId);
                shouldShowRetryButton = true;
                addRetryButtonIfNeeded();
            }));
        }
        addRetryButtonIfNeeded();
        addWaitWarningIfNeeded();
    }
    hasSameContent(other) {
        return other.kind === this.content.kind && !!other.errorDetails.isQuotaExceeded;
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatQuotaExceededPart = __decorate([
    __param(3, IChatWidgetService),
    __param(4, ICommandService),
    __param(5, ITelemetryService),
    __param(6, IChatEntitlementService)
], ChatQuotaExceededPart);
export { ChatQuotaExceededPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFF1b3RhRXhjZWVkZWRQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL2NoYXRRdW90YUV4Y2VlZGVkUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUV6RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsVUFBVSxFQUFlLE1BQU0seUNBQXlDLENBQUM7QUFDbEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUVqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxhQUFhLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRyxPQUFPLEVBQUUsZUFBZSxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFdEgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FB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