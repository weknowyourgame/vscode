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
import { renderLabelWithIcons } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { coalesce } from '../../../../../base/common/arrays.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { groupBy } from '../../../../../base/common/collections.js';
import { autorun } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { ActionWidgetDropdownActionViewItem } from '../../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js';
import { getFlatActionBarActions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IChatAgentService } from '../../common/chatAgents.js';
import { ChatMode, IChatModeService } from '../../common/chatModes.js';
import { ChatAgentLocation, ChatConfiguration, ChatModeKind } from '../../common/constants.js';
import { PromptsStorage } from '../../common/promptSyntax/service/promptsService.js';
import { getOpenChatActionIdForMode } from '../actions/chatActions.js';
import { ToggleAgentModeActionId } from '../actions/chatExecuteActions.js';
let ModePickerActionItem = class ModePickerActionItem extends ActionWidgetDropdownActionViewItem {
    constructor(action, delegate, actionWidgetService, chatAgentService, keybindingService, configurationService, contextKeyService, chatModeService, menuService, commandService, productService) {
        // Category definitions (use empty labels if you want no visible group headers)
        const builtInCategory = { label: localize('built-in', "Built-In"), order: 0 };
        const customCategory = { label: localize('custom', "Custom"), order: 1 };
        const policyDisabledCategory = { label: localize('managedByOrganization', "Managed by your organization"), order: 999 };
        const makeAction = (mode, currentMode) => {
            const agentModeDisabledViaPolicy = mode.kind === ChatModeKind.Agent &&
                this.configurationService.inspect(ChatConfiguration.AgentEnabled).policyValue === false;
            const tooltip = chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, mode.kind)?.description ?? action.tooltip;
            return {
                ...action,
                id: getOpenChatActionIdForMode(mode),
                label: mode.label.get(),
                icon: agentModeDisabledViaPolicy ? ThemeIcon.fromId(Codicon.lock.id) : undefined,
                class: agentModeDisabledViaPolicy ? 'disabled-by-policy' : undefined,
                enabled: !agentModeDisabledViaPolicy,
                checked: !agentModeDisabledViaPolicy && currentMode.id === mode.id,
                tooltip,
                run: async () => {
                    if (agentModeDisabledViaPolicy) {
                        return; // Block interaction if disabled by policy
                    }
                    const result = await commandService.executeCommand(ToggleAgentModeActionId, { modeId: mode.id, sessionResource: this.delegate.sessionResource() });
                    this.renderLabel(this.element);
                    return result;
                },
                category: agentModeDisabledViaPolicy ? policyDisabledCategory : builtInCategory
            };
        };
        const makeActionFromCustomMode = (mode, currentMode) => ({
            ...makeAction(mode, currentMode),
            tooltip: mode.description.get() ?? chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, mode.kind)?.description ?? action.tooltip,
            category: customCategory
        });
        const actionProvider = {
            getActions: () => {
                const modes = chatModeService.getModes();
                const currentMode = delegate.currentMode.get();
                const agentMode = modes.builtin.find(mode => mode.id === ChatMode.Agent.id);
                const otherBuiltinModes = modes.builtin.filter(mode => mode.id !== ChatMode.Agent.id);
                const customModes = groupBy(modes.custom, mode => mode.source?.storage === PromptsStorage.extension && mode.source.extensionId.value === productService.defaultChatAgent?.chatExtensionId ?
                    'builtin' : 'custom');
                const customBuiltinModeActions = customModes.builtin?.map(mode => {
                    const action = makeActionFromCustomMode(mode, currentMode);
                    action.category = builtInCategory;
                    return action;
                }) ?? [];
                const orderedModes = coalesce([
                    agentMode && makeAction(agentMode, currentMode),
                    ...otherBuiltinModes.map(mode => mode && makeAction(mode, currentMode)),
                    ...customBuiltinModeActions, ...customModes.custom?.map(mode => makeActionFromCustomMode(mode, currentMode)) ?? []
                ]);
                return orderedModes;
            }
        };
        const modePickerActionWidgetOptions = {
            actionProvider,
            actionBarActionProvider: {
                getActions: () => this.getModePickerActionBarActions()
            },
            showItemKeybindings: true
        };
        super(action, modePickerActionWidgetOptions, actionWidgetService, keybindingService, contextKeyService);
        this.delegate = delegate;
        this.configurationService = configurationService;
        this.contextKeyService = contextKeyService;
        this.menuService = menuService;
        // Listen to changes in the current mode and its properties
        this._register(autorun(reader => {
            this.delegate.currentMode.read(reader).label.read(reader); // use the reader so autorun tracks it
            if (this.element) {
                this.renderLabel(this.element);
            }
        }));
    }
    getModePickerActionBarActions() {
        const menuActions = this.menuService.createMenu(MenuId.ChatModePicker, this.contextKeyService);
        const menuContributions = getFlatActionBarActions(menuActions.getActions({ renderShortTitle: true }));
        menuActions.dispose();
        return menuContributions;
    }
    renderLabel(element) {
        this.setAriaLabelAttributes(element);
        const state = this.delegate.currentMode.get().label.get();
        dom.reset(element, dom.$('span.chat-model-label', undefined, state), ...renderLabelWithIcons(`$(chevron-down)`));
        return null;
    }
    render(container) {
        super.render(container);
        container.classList.add('chat-modelPicker-item');
    }
};
ModePickerActionItem = __decorate([
    __param(2, IActionWidgetService),
    __param(3, IChatAgentService),
    __param(4, IKeybindingService),
    __param(5, IConfigurationService),
    __param(6, IContextKeyService),
    __param(7, IChatModeService),
    __param(8, IMenuService),
    __param(9, ICommandService),
    __param(10, IProductService)
], ModePickerActionItem);
export { ModePickerActionItem };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZVBpY2tlckFjdGlvbkl0ZW0uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL21vZGVsUGlja2VyL21vZGVQaWNrZXJBY3Rpb25JdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFOUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFcEUsT0FBTyxFQUFFLE9BQU8sRUFBZSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUVwRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDbkksT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sb0VBQW9FLENBQUM7QUFDN0csT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQWtCLE1BQU0sbURBQW1ELENBQUM7QUFDekcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFFcEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUMzRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFhLGdCQUFnQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQy9GLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNyRixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUN2RSxPQUFPLEVBQXVCLHVCQUF1QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFPekYsSUFBTSxvQkFBb0IsR0FBMUIsTUFBTSxvQkFBcUIsU0FBUSxrQ0FBa0M7SUFDM0UsWUFDQyxNQUFzQixFQUNMLFFBQTZCLEVBQ3hCLG1CQUF5QyxFQUM1QyxnQkFBbUMsRUFDbEMsaUJBQXFDLEVBQ2pCLG9CQUEyQyxFQUM5QyxpQkFBcUMsRUFDeEQsZUFBaUMsRUFDcEIsV0FBeUIsRUFDdkMsY0FBK0IsRUFDL0IsY0FBK0I7UUFFaEQsK0VBQStFO1FBQy9FLE1BQU0sZUFBZSxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQzlFLE1BQU0sY0FBYyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQ3pFLE1BQU0sc0JBQXNCLEdBQUcsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLHVCQUF1QixFQUFFLDhCQUE4QixDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBRXhILE1BQU0sVUFBVSxHQUFHLENBQUMsSUFBZSxFQUFFLFdBQXNCLEVBQStCLEVBQUU7WUFDM0YsTUFBTSwwQkFBMEIsR0FDL0IsSUFBSSxDQUFDLElBQUksS0FBSyxZQUFZLENBQUMsS0FBSztnQkFDaEMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBVSxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsQ0FBQyxXQUFXLEtBQUssS0FBSyxDQUFDO1lBRWxHLE1BQU0sT0FBTyxHQUFHLGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLFdBQVcsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDO1lBRW5ILE9BQU87Z0JBQ04sR0FBRyxNQUFNO2dCQUNULEVBQUUsRUFBRSwwQkFBMEIsQ0FBQyxJQUFJLENBQUM7Z0JBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRTtnQkFDdkIsSUFBSSxFQUFFLDBCQUEwQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7Z0JBQ2hGLEtBQUssRUFBRSwwQkFBMEIsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLFNBQVM7Z0JBQ3BFLE9BQU8sRUFBRSxDQUFDLDBCQUEwQjtnQkFDcEMsT0FBTyxFQUFFLENBQUMsMEJBQTBCLElBQUksV0FBVyxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsRUFBRTtnQkFDbEUsT0FBTztnQkFDUCxHQUFHLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQ2YsSUFBSSwwQkFBMEIsRUFBRSxDQUFDO3dCQUNoQyxPQUFPLENBQUMsMENBQTBDO29CQUNuRCxDQUFDO29CQUNELE1BQU0sTUFBTSxHQUFHLE1BQU0sY0FBYyxDQUFDLGNBQWMsQ0FDakQsdUJBQXVCLEVBQ3ZCLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxFQUFFLEVBQWdDLENBQ25HLENBQUM7b0JBQ0YsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBUSxDQUFDLENBQUM7b0JBQ2hDLE9BQU8sTUFBTSxDQUFDO2dCQUNmLENBQUM7Z0JBQ0QsUUFBUSxFQUFFLDBCQUEwQixDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsZUFBZTthQUMvRSxDQUFDO1FBQ0gsQ0FBQyxDQUFDO1FBRUYsTUFBTSx3QkFBd0IsR0FBRyxDQUFDLElBQWUsRUFBRSxXQUFzQixFQUErQixFQUFFLENBQUMsQ0FBQztZQUMzRyxHQUFHLFVBQVUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDO1lBQ2hDLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLFdBQVcsSUFBSSxNQUFNLENBQUMsT0FBTztZQUNySSxRQUFRLEVBQUUsY0FBYztTQUN4QixDQUFDLENBQUM7UUFFSCxNQUFNLGNBQWMsR0FBd0M7WUFDM0QsVUFBVSxFQUFFLEdBQUcsRUFBRTtnQkFDaEIsTUFBTSxLQUFLLEdBQUcsZUFBZSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUN6QyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUMvQyxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDNUUsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDdEYsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUMxQixLQUFLLENBQUMsTUFBTSxFQUNaLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxPQUFPLEtBQUssY0FBYyxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEtBQUssY0FBYyxDQUFDLGdCQUFnQixFQUFFLGVBQWUsQ0FBQyxDQUFDO29CQUNoSixTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUV4QixNQUFNLHdCQUF3QixHQUFHLFdBQVcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNoRSxNQUFNLE1BQU0sR0FBRyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7b0JBQzNELE1BQU0sQ0FBQyxRQUFRLEdBQUcsZUFBZSxDQUFDO29CQUNsQyxPQUFPLE1BQU0sQ0FBQztnQkFDZixDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBRVQsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDO29CQUM3QixTQUFTLElBQUksVUFBVSxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUM7b0JBQy9DLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLFVBQVUsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7b0JBQ3ZFLEdBQUcsd0JBQXdCLEVBQUUsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQyxJQUFJLEVBQUU7aUJBQ2xILENBQUMsQ0FBQztnQkFDSCxPQUFPLFlBQVksQ0FBQztZQUNyQixDQUFDO1NBQ0QsQ0FBQztRQUVGLE1BQU0sNkJBQTZCLEdBQWtFO1lBQ3BHLGNBQWM7WUFDZCx1QkFBdUIsRUFBRTtnQkFDeEIsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyw2QkFBNkIsRUFBRTthQUN0RDtZQUNELG1CQUFtQixFQUFFLElBQUk7U0FDekIsQ0FBQztRQUVGLEtBQUssQ0FBQyxNQUFNLEVBQUUsNkJBQTZCLEVBQUUsbUJBQW1CLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQXZGdkYsYUFBUSxHQUFSLFFBQVEsQ0FBcUI7UUFJTix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQzlDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFFM0MsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUFrRnhELDJEQUEyRDtRQUMzRCxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUMvQixJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLHNDQUFzQztZQUNqRyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDaEMsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU8sNkJBQTZCO1FBQ3BDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDL0YsTUFBTSxpQkFBaUIsR0FBRyx1QkFBdUIsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3RHLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUV0QixPQUFPLGlCQUFpQixDQUFDO0lBQzFCLENBQUM7SUFFa0IsV0FBVyxDQUFDLE9BQW9CO1FBQ2xELElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNyQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDMUQsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLEVBQUUsR0FBRyxvQkFBb0IsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7UUFDakgsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRVEsTUFBTSxDQUFDLFNBQXNCO1FBQ3JDLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDeEIsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQztJQUNsRCxDQUFDO0NBQ0QsQ0FBQTtBQXhIWSxvQkFBb0I7SUFJOUIsV0FBQSxvQkFBb0IsQ0FBQTtJQUNwQixXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsa0JBQWtCLENBQUE7SUFDbEIsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsZ0JBQWdCLENBQUE7SUFDaEIsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLGVBQWUsQ0FBQTtJQUNmLFlBQUEsZUFBZSxDQUFBO0dBWkwsb0JBQW9CLENBd0hoQyJ9