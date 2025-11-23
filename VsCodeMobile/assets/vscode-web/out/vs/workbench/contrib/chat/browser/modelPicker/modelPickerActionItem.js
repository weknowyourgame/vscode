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
import { localize } from '../../../../../nls.js';
import * as dom from '../../../../../base/browser/dom.js';
import { renderLabelWithIcons } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { ActionWidgetDropdownActionViewItem } from '../../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ChatEntitlement, IChatEntitlementService } from '../../../../services/chat/common/chatEntitlementService.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { DEFAULT_MODEL_PICKER_CATEGORY } from '../../common/modelPicker/modelPickerWidget.js';
import { ManageModelsAction } from '../actions/manageModelsActions.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { MANAGE_CHAT_COMMAND_ID } from '../../common/constants.js';
import { TelemetryTrustedValue } from '../../../../../platform/telemetry/common/telemetryUtils.js';
function modelDelegateToWidgetActionsProvider(delegate, telemetryService) {
    return {
        getActions: () => {
            return delegate.getModels().map(model => {
                return {
                    id: model.metadata.id,
                    enabled: true,
                    icon: model.metadata.statusIcon,
                    checked: model.identifier === delegate.getCurrentModel()?.identifier,
                    category: model.metadata.modelPickerCategory || DEFAULT_MODEL_PICKER_CATEGORY,
                    class: undefined,
                    description: model.metadata.detail,
                    tooltip: model.metadata.tooltip ?? model.metadata.name,
                    label: model.metadata.name,
                    run: () => {
                        const previousModel = delegate.getCurrentModel();
                        telemetryService.publicLog2('chat.modelChange', {
                            fromModel: previousModel?.metadata.vendor === 'copilot' ? new TelemetryTrustedValue(previousModel.identifier) : 'unknown',
                            toModel: model.metadata.vendor === 'copilot' ? new TelemetryTrustedValue(model.identifier) : 'unknown'
                        });
                        delegate.setModel(model);
                    }
                };
            });
        }
    };
}
function getModelPickerActionBarActionProvider(commandService, chatEntitlementService, productService) {
    const actionProvider = {
        getActions: () => {
            const additionalActions = [];
            if (chatEntitlementService.entitlement === ChatEntitlement.Free ||
                chatEntitlementService.entitlement === ChatEntitlement.Pro ||
                chatEntitlementService.entitlement === ChatEntitlement.ProPlus ||
                chatEntitlementService.isInternal) {
                additionalActions.push({
                    id: 'manageModels',
                    label: localize('chat.manageModels', "Manage Models..."),
                    enabled: true,
                    tooltip: localize('chat.manageModels.tooltip', "Manage Language Models"),
                    class: undefined,
                    run: () => {
                        const commandId = ManageModelsAction.ID;
                        commandService.executeCommand(productService.quality === 'stable' ? commandId : MANAGE_CHAT_COMMAND_ID);
                    }
                });
            }
            // Add sign-in / upgrade option if entitlement is anonymous / free / new user
            const isNewOrAnonymousUser = !chatEntitlementService.sentiment.installed ||
                chatEntitlementService.entitlement === ChatEntitlement.Available ||
                chatEntitlementService.anonymous ||
                chatEntitlementService.entitlement === ChatEntitlement.Unknown;
            if (isNewOrAnonymousUser || chatEntitlementService.entitlement === ChatEntitlement.Free) {
                additionalActions.push({
                    id: 'moreModels',
                    label: isNewOrAnonymousUser ? localize('chat.moreModels', "Add Language Models") : localize('chat.morePremiumModels', "Add Premium Models"),
                    enabled: true,
                    tooltip: isNewOrAnonymousUser ? localize('chat.moreModels.tooltip', "Add Language Models") : localize('chat.morePremiumModels.tooltip', "Add Premium Models"),
                    class: undefined,
                    run: () => {
                        const commandId = isNewOrAnonymousUser ? 'workbench.action.chat.triggerSetup' : 'workbench.action.chat.upgradePlan';
                        commandService.executeCommand(commandId);
                    }
                });
            }
            return additionalActions;
        }
    };
    return actionProvider;
}
/**
 * Action view item for selecting a language model in the chat interface.
 */
let ModelPickerActionItem = class ModelPickerActionItem extends ActionWidgetDropdownActionViewItem {
    constructor(action, currentModel, widgetOptions, delegate, actionWidgetService, contextKeyService, commandService, chatEntitlementService, keybindingService, telemetryService, productService) {
        // Modify the original action with a different label and make it show the current model
        const actionWithLabel = {
            ...action,
            label: currentModel?.metadata.name ?? localize('chat.modelPicker.label', "Pick Model"),
            tooltip: localize('chat.modelPicker.label', "Pick Model"),
            run: () => { }
        };
        const modelPickerActionWidgetOptions = {
            actionProvider: modelDelegateToWidgetActionsProvider(delegate, telemetryService),
            actionBarActionProvider: getModelPickerActionBarActionProvider(commandService, chatEntitlementService, productService)
        };
        super(actionWithLabel, widgetOptions ?? modelPickerActionWidgetOptions, actionWidgetService, keybindingService, contextKeyService);
        this.currentModel = currentModel;
        // Listen for model changes from the delegate
        this._register(delegate.onDidChangeModel(model => {
            this.currentModel = model;
            if (this.element) {
                this.renderLabel(this.element);
            }
        }));
    }
    renderLabel(element) {
        const domChildren = [];
        if (this.currentModel?.metadata.statusIcon) {
            domChildren.push(...renderLabelWithIcons(`\$(${this.currentModel.metadata.statusIcon.id})`));
        }
        domChildren.push(dom.$('span.chat-model-label', undefined, this.currentModel?.metadata.name ?? localize('chat.modelPicker.label', "Pick Model")));
        domChildren.push(...renderLabelWithIcons(`$(chevron-down)`));
        dom.reset(element, ...domChildren);
        this.setAriaLabelAttributes(element);
        return null;
    }
    render(container) {
        super.render(container);
        container.classList.add('chat-modelPicker-item');
    }
};
ModelPickerActionItem = __decorate([
    __param(4, IActionWidgetService),
    __param(5, IContextKeyService),
    __param(6, ICommandService),
    __param(7, IChatEntitlementService),
    __param(8, IKeybindingService),
    __param(9, ITelemetryService),
    __param(10, IProductService)
], ModelPickerActionItem);
export { ModelPickerActionItem };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZWxQaWNrZXJBY3Rpb25JdGVtLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9tb2RlbFBpY2tlci9tb2RlbFBpY2tlckFjdGlvbkl0ZW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFLaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFOUYsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDbkksT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFFcEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0YsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxlQUFlLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUN0SCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM5RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV2RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDbkUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFz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