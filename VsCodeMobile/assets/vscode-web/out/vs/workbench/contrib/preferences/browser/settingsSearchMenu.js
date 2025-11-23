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
import { DropdownMenuActionViewItem } from '../../../../base/browser/ui/dropdown/dropdownActionViewItem.js';
import { Separator } from '../../../../base/common/actions.js';
import { SuggestController } from '../../../../editor/contrib/suggest/browser/suggestController.js';
import { localize } from '../../../../nls.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { ADVANCED_SETTING_TAG, EXTENSION_SETTING_TAG, FEATURE_SETTING_TAG, GENERAL_TAG_SETTING_TAG, ID_SETTING_TAG, LANGUAGE_SETTING_TAG, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG } from '../common/preferences.js';
let SettingsSearchFilterDropdownMenuActionViewItem = class SettingsSearchFilterDropdownMenuActionViewItem extends DropdownMenuActionViewItem {
    constructor(action, options, actionRunner, searchWidget, contextMenuService) {
        super(action, { getActions: () => this.getActions() }, contextMenuService, {
            ...options,
            actionRunner,
            classNames: action.class,
            anchorAlignmentProvider: () => 1 /* AnchorAlignment.RIGHT */,
            menuAsChild: true
        });
        this.searchWidget = searchWidget;
        this.suggestController = SuggestController.get(this.searchWidget.inputWidget);
    }
    render(container) {
        super.render(container);
    }
    doSearchWidgetAction(queryToAppend, triggerSuggest) {
        this.searchWidget.setValue(this.searchWidget.getValue().trimEnd() + ' ' + queryToAppend);
        this.searchWidget.focus();
        if (triggerSuggest && this.suggestController) {
            this.suggestController.triggerSuggest();
        }
    }
    /**
     * The created action appends a query to the search widget search string. It optionally triggers suggestions.
     */
    createAction(id, label, tooltip, queryToAppend, triggerSuggest) {
        return {
            id,
            label,
            tooltip,
            class: undefined,
            enabled: true,
            run: () => { this.doSearchWidgetAction(queryToAppend, triggerSuggest); }
        };
    }
    /**
     * The created action appends a query to the search widget search string, if the query does not exist.
     * Otherwise, it removes the query from the search widget search string.
     * The action does not trigger suggestions after adding or removing the query.
     */
    createToggleAction(id, label, tooltip, queryToAppend) {
        const splitCurrentQuery = this.searchWidget.getValue().split(' ');
        const queryContainsQueryToAppend = splitCurrentQuery.includes(queryToAppend);
        return {
            id,
            label,
            tooltip,
            class: undefined,
            enabled: true,
            checked: queryContainsQueryToAppend,
            run: () => {
                if (!queryContainsQueryToAppend) {
                    const trimmedCurrentQuery = this.searchWidget.getValue().trimEnd();
                    const newQuery = trimmedCurrentQuery ? trimmedCurrentQuery + ' ' + queryToAppend : queryToAppend;
                    this.searchWidget.setValue(newQuery);
                }
                else {
                    const queryWithRemovedTags = this.searchWidget.getValue().split(' ')
                        .filter(word => word !== queryToAppend).join(' ');
                    this.searchWidget.setValue(queryWithRemovedTags);
                }
                this.searchWidget.focus();
            }
        };
    }
    createMutuallyExclusiveToggleAction(id, label, tooltip, filter, excludeFilters) {
        const isFilterEnabled = this.searchWidget.getValue().split(' ').includes(filter);
        return {
            id,
            label,
            tooltip,
            class: undefined,
            enabled: true,
            checked: isFilterEnabled,
            run: () => {
                if (isFilterEnabled) {
                    const queryWithRemovedTags = this.searchWidget.getValue().split(' ')
                        .filter(word => word !== filter).join(' ');
                    this.searchWidget.setValue(queryWithRemovedTags);
                }
                else {
                    let newQuery = this.searchWidget.getValue().split(' ')
                        .filter(word => !excludeFilters.includes(word) && word !== filter)
                        .join(' ')
                        .trimEnd();
                    newQuery = newQuery ? newQuery + ' ' + filter : filter;
                    this.searchWidget.setValue(newQuery);
                }
                this.searchWidget.focus();
            }
        };
    }
    getActions() {
        return [
            this.createToggleAction('modifiedSettingsSearch', localize('modifiedSettingsSearch', "Modified"), localize('modifiedSettingsSearchTooltip', "Add or remove modified settings filter"), `@${MODIFIED_SETTING_TAG}`),
            new Separator(),
            this.createAction('extSettingsSearch', localize('extSettingsSearch', "Extension ID..."), localize('extSettingsSearchTooltip', "Add extension ID filter"), `@${EXTENSION_SETTING_TAG}`, true),
            this.createAction('featuresSettingsSearch', localize('featureSettingsSearch', "Feature..."), localize('featureSettingsSearchTooltip', "Add feature filter"), `@${FEATURE_SETTING_TAG}`, true),
            this.createAction('tagSettingsSearch', localize('tagSettingsSearch', "Tag..."), localize('tagSettingsSearchTooltip', "Add tag filter"), `@${GENERAL_TAG_SETTING_TAG}`, true),
            this.createAction('langSettingsSearch', localize('langSettingsSearch', "Language..."), localize('langSettingsSearchTooltip', "Add language ID filter"), `@${LANGUAGE_SETTING_TAG}`, true),
            this.createAction('idSettingsSearch', localize('idSettingsSearch', "Setting ID..."), localize('idSettingsSearchTooltip', "Add Setting ID filter"), `@${ID_SETTING_TAG}`, false),
            new Separator(),
            this.createToggleAction('onlineSettingsSearch', localize('onlineSettingsSearch', "Online services"), localize('onlineSettingsSearchTooltip', "Show settings for online services"), '@tag:usesOnlineServices'),
            this.createToggleAction('policySettingsSearch', localize('policySettingsSearch', "Organization policies"), localize('policySettingsSearchTooltip', "Show organization policy settings"), `@${POLICY_SETTING_TAG}`),
            new Separator(),
            this.createMutuallyExclusiveToggleAction('stableSettingsSearch', localize('stableSettings', "Stable"), localize('stableSettingsSearchTooltip', "Show stable settings"), `@stable`, ['@tag:preview', '@tag:experimental']),
            this.createMutuallyExclusiveToggleAction('previewSettingsSearch', localize('previewSettings', "Preview"), localize('previewSettingsSearchTooltip', "Show preview settings"), `@tag:preview`, ['@stable', '@tag:experimental']),
            this.createMutuallyExclusiveToggleAction('experimentalSettingsSearch', localize('experimental', "Experimental"), localize('experimentalSettingsSearchTooltip', "Show experimental settings"), `@tag:experimental`, ['@stable', '@tag:preview']),
            new Separator(),
            this.createToggleAction('advancedSettingsSearch', localize('advancedSettingsSearch', "Advanced"), localize('advancedSettingsSearchTooltip', "Show advanced settings"), `@tag:${ADVANCED_SETTING_TAG}`),
        ];
    }
};
SettingsSearchFilterDropdownMenuActionViewItem = __decorate([
    __param(4, IContextMenuService)
], SettingsSearchFilterDropdownMenuActionViewItem);
export { SettingsSearchFilterDropdownMenuActionViewItem };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3NTZWFyY2hNZW51LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3ByZWZlcmVuY2VzL2Jyb3dzZXIvc2V0dGluZ3NTZWFyY2hNZW51LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBSWhHLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQzVHLE9BQU8sRUFBMEIsU0FBUyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdkYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDcEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRTlGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxxQkFBcUIsRUFBRSxtQkFBbUIsRUFBRSx1QkFBdUIsRUFBRSxjQUFjLEVBQUUsb0JBQW9CLEVBQUUsb0JBQW9CLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUU5TSxJQUFNLDhDQUE4QyxHQUFwRCxNQUFNLDhDQUErQyxTQUFRLDBCQUEwQjtJQUc3RixZQUNDLE1BQWUsRUFDZixPQUErQixFQUMvQixZQUF1QyxFQUN0QixZQUFpQyxFQUM3QixrQkFBdUM7UUFFNUQsS0FBSyxDQUFDLE1BQU0sRUFDWCxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsRUFDdkMsa0JBQWtCLEVBQ2xCO1lBQ0MsR0FBRyxPQUFPO1lBQ1YsWUFBWTtZQUNaLFVBQVUsRUFBRSxNQUFNLENBQUMsS0FBSztZQUN4Qix1QkFBdUIsRUFBRSxHQUFHLEVBQUUsOEJBQXNCO1lBQ3BELFdBQVcsRUFBRSxJQUFJO1NBQ2pCLENBQ0QsQ0FB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