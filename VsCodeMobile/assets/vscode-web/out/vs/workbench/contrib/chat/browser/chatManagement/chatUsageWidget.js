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
import './media/chatUsageWidget.css';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import * as DOM from '../../../../../base/browser/dom.js';
import { localize } from '../../../../../nls.js';
import { IChatEntitlementService } from '../../../../services/chat/common/chatEntitlementService.js';
import { language } from '../../../../../base/common/platform.js';
import { safeIntl } from '../../../../../base/common/date.js';
const $ = DOM.$;
let ChatUsageWidget = class ChatUsageWidget extends Disposable {
    constructor(chatEntitlementService) {
        super();
        this.chatEntitlementService = chatEntitlementService;
        this._onDidChangeContentHeight = new Emitter();
        this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
        this.dateFormatter = safeIntl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric' });
        this.dateTimeFormatter = safeIntl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        this.element = DOM.$('.chat-usage-widget');
        this.create(this.element);
        this.render();
        // Update when quotas or entitlements change
        this._register(this.chatEntitlementService.onDidChangeQuotaRemaining(() => this.render()));
        this._register(this.chatEntitlementService.onDidChangeEntitlement(() => this.render()));
    }
    create(container) {
        // Content container
        this.usageSection = DOM.append(container, $('.copilot-usage-section'));
    }
    render() {
        DOM.clearNode(this.usageSection);
        const { chat: chatQuota, completions: completionsQuota, premiumChat: premiumChatQuota, resetDate, resetDateHasTime } = this.chatEntitlementService.quotas;
        // Anonymous Indicator - show limited quotas
        if (this.chatEntitlementService.anonymous && this.chatEntitlementService.sentiment.installed && !completionsQuota && !chatQuota && !premiumChatQuota) {
            this.renderLimitedQuotaItem(this.usageSection, localize('completionsLabel', 'Inline Suggestions'));
            this.renderLimitedQuotaItem(this.usageSection, localize('chatsLabel', 'Chat messages'));
        }
        // Copilot Usage section - show detailed breakdown of all quotas
        else if (completionsQuota || chatQuota || premiumChatQuota) {
            // Inline Suggestions
            if (completionsQuota) {
                this.renderQuotaItem(this.usageSection, localize('plan.inlineSuggestions', 'Inline Suggestions'), completionsQuota);
            }
            // Chat messages
            if (chatQuota) {
                this.renderQuotaItem(this.usageSection, localize('plan.chatMessages', 'Chat messages'), chatQuota);
            }
            // Premium requests
            if (premiumChatQuota) {
                this.renderQuotaItem(this.usageSection, localize('plan.premiumRequests', 'Premium requests'), premiumChatQuota);
                // Additional overage message
                if (premiumChatQuota.overageEnabled) {
                    const overageMessage = DOM.append(this.usageSection, $('.overage-message'));
                    overageMessage.textContent = localize('plan.additionalPaidEnabled', 'Additional paid premium requests enabled.');
                }
            }
            // Reset date
            if (resetDate) {
                const resetText = DOM.append(this.usageSection, $('.allowance-resets'));
                resetText.textContent = localize('plan.allowanceResets', 'Allowance resets {0}.', resetDateHasTime ? this.dateTimeFormatter.value.format(new Date(resetDate)) : this.dateFormatter.value.format(new Date(resetDate)));
            }
        }
        // Emit height change
        const height = this.element.offsetHeight || 400;
        this._onDidChangeContentHeight.fire(height);
    }
    renderQuotaItem(container, label, quota) {
        const quotaItem = DOM.append(container, $('.quota-item'));
        const quotaItemHeader = DOM.append(quotaItem, $('.quota-item-header'));
        const quotaItemLabel = DOM.append(quotaItemHeader, $('.quota-item-label'));
        quotaItemLabel.textContent = label;
        const quotaItemValue = DOM.append(quotaItemHeader, $('.quota-item-value'));
        if (quota.unlimited) {
            quotaItemValue.textContent = localize('plan.included', 'Included');
        }
        else {
            quotaItemValue.textContent = localize('plan.included', 'Included');
        }
        // Progress bar - using same structure as chat status
        const progressBarContainer = DOM.append(quotaItem, $('.quota-bar'));
        const progressBar = DOM.append(progressBarContainer, $('.quota-bit'));
        const percentageUsed = this.getQuotaPercentageUsed(quota);
        progressBar.style.width = percentageUsed + '%';
        // Apply warning/error classes based on usage
        if (percentageUsed >= 90) {
            quotaItem.classList.add('error');
        }
        else if (percentageUsed >= 75) {
            quotaItem.classList.add('warning');
        }
    }
    getQuotaPercentageUsed(quota) {
        if (quota.unlimited) {
            return 0;
        }
        return Math.max(0, 100 - quota.percentRemaining);
    }
    renderLimitedQuotaItem(container, label) {
        const quotaItem = DOM.append(container, $('.quota-item'));
        const quotaItemHeader = DOM.append(quotaItem, $('.quota-item-header'));
        const quotaItemLabel = DOM.append(quotaItemHeader, $('.quota-item-label'));
        quotaItemLabel.textContent = label;
        const quotaItemValue = DOM.append(quotaItemHeader, $('.quota-item-value'));
        quotaItemValue.textContent = localize('quotaLimited', 'Limited');
        // Progress bar - using same structure as chat status
        const progressBarContainer = DOM.append(quotaItem, $('.quota-bar'));
        DOM.append(progressBarContainer, $('.quota-bit'));
    }
};
ChatUsageWidget = __decorate([
    __param(0, IChatEntitlementService)
], ChatUsageWidget);
export { ChatUsageWidget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFVzYWdlV2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0TWFuYWdlbWVudC9jaGF0VXNhZ2VXaWRnZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyw2QkFBNkIsQ0FBQztBQUNyQyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSx1QkFBdUIsRUFBa0IsTUFBTSw0REFBNEQsQ0FBQztBQUNySCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRTlELE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFFVCxJQUFNLGVBQWUsR0FBckIsTUFBTSxlQUFnQixTQUFRLFVBQVU7SUFXOUMsWUFDMEIsc0JBQWdFO1FBRXpGLEtBQUssRUFBRSxDQUFDO1FBRmtDLDJCQUFzQixHQUF0QixzQkFBc0IsQ0FBeUI7UUFWekUsOEJBQXlCLEdBQUcsSUFBSSxPQUFPLEVBQVUsQ0FBQztRQUMxRCw2QkFBd0IsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsS0FBSyxDQUFDO1FBS3hELGtCQUFhLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxDQUFDLENB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