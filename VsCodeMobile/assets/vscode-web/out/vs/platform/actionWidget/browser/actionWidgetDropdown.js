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
import { IActionWidgetService } from './actionWidget.js';
import { BaseDropdown } from '../../../base/browser/ui/dropdown/dropdown.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { Codicon } from '../../../base/common/codicons.js';
import { getActiveElement, isHTMLElement } from '../../../base/browser/dom.js';
import { IKeybindingService } from '../../keybinding/common/keybinding.js';
/**
 * Action widget dropdown is a dropdown that uses the action widget under the hood to simulate a native dropdown menu
 * The benefits of this include non native features such as headers, descriptions, icons, and button bar
 */
let ActionWidgetDropdown = class ActionWidgetDropdown extends BaseDropdown {
    constructor(container, _options, actionWidgetService, keybindingService) {
        super(container, _options);
        this._options = _options;
        this.actionWidgetService = actionWidgetService;
        this.keybindingService = keybindingService;
        this.enabled = true;
    }
    show() {
        if (!this.enabled) {
            return;
        }
        let actionBarActions = this._options.actionBarActions ?? this._options.actionBarActionProvider?.getActions() ?? [];
        const actions = this._options.actions ?? this._options.actionProvider?.getActions() ?? [];
        const actionWidgetItems = [];
        const actionsByCategory = new Map();
        for (const action of actions) {
            let category = action.category;
            if (!category) {
                category = { label: '', order: Number.MIN_SAFE_INTEGER };
            }
            if (!actionsByCategory.has(category.label)) {
                actionsByCategory.set(category.label, []);
            }
            actionsByCategory.get(category.label).push(action);
        }
        // Sort categories by order
        const sortedCategories = Array.from(actionsByCategory.entries())
            .sort((a, b) => {
            const aOrder = a[1][0]?.category?.order ?? Number.MAX_SAFE_INTEGER;
            const bOrder = b[1][0]?.category?.order ?? Number.MAX_SAFE_INTEGER;
            return aOrder - bOrder;
        });
        for (let i = 0; i < sortedCategories.length; i++) {
            const [categoryLabel, categoryActions] = sortedCategories[i];
            // Add category header if label is not empty
            if (categoryLabel) {
                actionWidgetItems.push({
                    kind: "header" /* ActionListItemKind.Header */,
                    label: categoryLabel,
                    canPreview: false,
                    disabled: false,
                    hideIcon: false,
                });
            }
            // Push actions for each category
            for (const action of categoryActions) {
                actionWidgetItems.push({
                    item: action,
                    tooltip: action.tooltip,
                    description: action.description,
                    kind: "action" /* ActionListItemKind.Action */,
                    canPreview: false,
                    group: { title: '', icon: action.icon ?? ThemeIcon.fromId(action.checked ? Codicon.check.id : Codicon.blank.id) },
                    disabled: !action.enabled,
                    hideIcon: false,
                    label: action.label,
                    keybinding: this._options.showItemKeybindings ?
                        this.keybindingService.lookupKeybinding(action.id) :
                        undefined,
                });
            }
            // Add separator after each category except the last one
            if (i < sortedCategories.length - 1) {
                actionWidgetItems.push({
                    label: '',
                    kind: "separator" /* ActionListItemKind.Separator */,
                    canPreview: false,
                    disabled: false,
                    hideIcon: false,
                });
            }
        }
        const previouslyFocusedElement = getActiveElement();
        const actionWidgetDelegate = {
            onSelect: (action, preview) => {
                this.actionWidgetService.hide();
                action.run();
            },
            onHide: () => {
                if (isHTMLElement(previouslyFocusedElement)) {
                    previouslyFocusedElement.focus();
                }
            }
        };
        actionBarActions = actionBarActions.map(action => ({
            ...action,
            run: async (...args) => {
                this.actionWidgetService.hide();
                return action.run(...args);
            }
        }));
        const accessibilityProvider = {
            isChecked(element) {
                return element.kind === "action" /* ActionListItemKind.Action */ && !!element?.item?.checked;
            },
            getRole: (e) => {
                switch (e.kind) {
                    case "action" /* ActionListItemKind.Action */:
                        return 'menuitemcheckbox';
                    case "separator" /* ActionListItemKind.Separator */:
                        return 'separator';
                    default:
                        return 'separator';
                }
            },
            getWidgetRole: () => 'menu',
        };
        this.actionWidgetService.show(this._options.label ?? '', false, actionWidgetItems, actionWidgetDelegate, this.element, undefined, actionBarActions, accessibilityProvider);
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
};
ActionWidgetDropdown = __decorate([
    __param(2, IActionWidgetService),
    __param(3, IKeybindingService)
], ActionWidgetDropdown);
export { ActionWidgetDropdown };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9uV2lkZ2V0RHJvcGRvd24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vYWN0aW9uV2lkZ2V0L2Jyb3dzZXIvYWN0aW9uV2lkZ2V0RHJvcGRvd24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFekQsT0FBTyxFQUFFLFlBQVksRUFBeUMsTUFBTSwrQ0FBK0MsQ0FBQztBQUVwSCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQXlCM0U7OztHQUdHO0FBQ0ksSUFBTSxvQkFBb0IsR0FBMUIsTUFBTSxvQkFBcUIsU0FBUSxZQUFZO0lBSXJELFlBQ0MsU0FBc0IsRUFDTCxRQUFzQyxFQUNqQyxtQkFBMEQsRUFDNUQsaUJBQXNEO1FBRTFFLEtBQUssQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFKVixhQUFRLEdBQVIsUUFBUSxDQUE4QjtRQUNoQix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXNCO1FBQzNDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFObkUsWUFBTyxHQUFZLElBQUksQ0FBQztJQVNoQyxDQUFDO0lBRVEsSUFBSTtRQUNaLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkIsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLGdCQUFnQixHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFD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