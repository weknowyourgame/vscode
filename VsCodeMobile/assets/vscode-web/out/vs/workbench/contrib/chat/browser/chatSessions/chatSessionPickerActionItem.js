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
import './media/chatSessionAction.css';
import * as dom from '../../../../../base/browser/dom.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IChatEntitlementService } from '../../../../services/chat/common/chatEntitlementService.js';
import { ActionWidgetDropdownActionViewItem } from '../../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js';
import { renderLabelWithIcons, renderIcon } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { localize } from '../../../../../nls.js';
/**
 * Action view item for making an option selection for a contributed chat session
 * These options are provided by the relevant ChatSession Provider
 */
let ChatSessionPickerActionItem = class ChatSessionPickerActionItem extends ActionWidgetDropdownActionViewItem {
    constructor(action, initialState, delegate, actionWidgetService, contextKeyService, commandService, chatEntitlementService, keybindingService, telemetryService) {
        const { group, item } = initialState;
        const actionWithLabel = {
            ...action,
            label: item?.name || group.name,
            tooltip: group.description || group.name,
            run: () => { }
        };
        const sessionPickerActionWidgetOptions = {
            actionProvider: {
                getActions: () => {
                    // if locked, show the current option only
                    const currentOption = this.delegate.getCurrentOption();
                    if (currentOption?.locked) {
                        return [{
                                id: currentOption.id,
                                enabled: false,
                                icon: currentOption.icon,
                                checked: true,
                                class: undefined,
                                description: undefined,
                                tooltip: currentOption.name,
                                label: currentOption.name,
                                run: () => { }
                            }];
                    }
                    else {
                        return this.delegate.getAllOptions().map(optionItem => {
                            const isCurrent = optionItem.id === this.delegate.getCurrentOption()?.id;
                            return {
                                id: optionItem.id,
                                enabled: true,
                                icon: optionItem.icon,
                                checked: isCurrent,
                                class: undefined,
                                description: undefined,
                                tooltip: optionItem.name,
                                label: optionItem.name,
                                run: () => {
                                    this.delegate.setOption(optionItem);
                                }
                            };
                        });
                    }
                }
            },
            actionBarActionProvider: undefined,
        };
        super(actionWithLabel, sessionPickerActionWidgetOptions, actionWidgetService, keybindingService, contextKeyService);
        this.delegate = delegate;
        this.currentOption = item;
        this._register(this.delegate.onDidChangeOption(newOption => {
            this.currentOption = newOption;
            if (this.element) {
                this.renderLabel(this.element);
            }
        }));
    }
    renderLabel(element) {
        const domChildren = [];
        element.classList.add('chat-session-option-picker');
        if (this.currentOption?.icon) {
            domChildren.push(renderIcon(this.currentOption.icon));
        }
        domChildren.push(dom.$('span.chat-session-option-label', undefined, this.currentOption?.name ?? localize('chat.sessionPicker.label', "Pick Option")));
        domChildren.push(...renderLabelWithIcons(`$(chevron-down)`));
        dom.reset(element, ...domChildren);
        this.setAriaLabelAttributes(element);
        return null;
    }
    render(container) {
        super.render(container);
        container.classList.add('chat-sessionPicker-item');
    }
};
ChatSessionPickerActionItem = __decorate([
    __param(3, IActionWidgetService),
    __param(4, IContextKeyService),
    __param(5, ICommandService),
    __param(6, IChatEntitlementService),
    __param(7, IKeybindingService),
    __param(8, ITelemetryService)
], ChatSessionPickerActionItem);
export { ChatSessionPickerActionItem };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlc3Npb25QaWNrZXJBY3Rpb25JdGVtLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0U2Vzc2lvbnMvY2hhdFNlc3Npb25QaWNrZXJBY3Rpb25JdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sK0JBQStCLENBQUM7QUFHdkMsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUVwRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDdEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0YsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDMUYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDckcsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFHbkksT0FBTyxFQUFFLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQVVqRDs7O0dBR0c7QUFDSSxJQUFNLDJCQUEyQixHQUFqQyxNQUFNLDJCQUE0QixTQUFRLGtDQUFrQztJQUVsRixZQUNDLE1BQWUsRUFDZixZQUEwRyxFQUN6RixRQUFvQyxFQUMvQixtQkFBeUMsRUFDM0MsaUJBQXFDLEVBQ3hDLGNBQStCLEVBQ3ZCLHNCQUErQyxFQUNwRCxpQkFBcUMsRUFDdEMsZ0JBQW1DO1FBRXRELE1BQU0sRUFB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