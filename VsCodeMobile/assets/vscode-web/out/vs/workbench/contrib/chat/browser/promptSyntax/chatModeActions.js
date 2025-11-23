/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CHAT_CATEGORY, CHAT_CONFIG_MENU_ID } from '../actions/chatActions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { localize, localize2 } from '../../../../../nls.js';
import { PromptFilePickers } from './pickers/promptFilePickers.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { ChatViewId } from '../chat.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
class ConfigAgentActionImpl extends Action2 {
    async run(accessor) {
        const instaService = accessor.get(IInstantiationService);
        const openerService = accessor.get(IOpenerService);
        const pickers = instaService.createInstance(PromptFilePickers);
        const placeholder = localize('configure.agent.prompts.placeholder', "Select the custom agents to open and configure visibility in the agent picker");
        const result = await pickers.selectPromptFile({ placeholder, type: PromptsType.agent, optionEdit: false, optionVisibility: true });
        if (result !== undefined) {
            await openerService.open(result.promptFile);
        }
    }
}
// Separate action `Configure Custom Agents` link in the agent picker.
const PICKER_CONFIGURE_AGENTS_ACTION_ID = 'workbench.action.chat.picker.customagents';
function createPickerConfigureAgentsActionConfig(disabled) {
    const config = {
        id: disabled ? PICKER_CONFIGURE_AGENTS_ACTION_ID + '.disabled' : PICKER_CONFIGURE_AGENTS_ACTION_ID,
        title: localize2('select-agent', "Configure Custom Agents..."),
        tooltip: disabled ? localize('managedByOrganization', "Managed by your organization") : undefined,
        icon: disabled ? Codicon.lock : undefined,
        category: CHAT_CATEGORY,
        f1: false,
        precondition: disabled ? ContextKeyExpr.false() : ChatContextKeys.Modes.agentModeDisabledByPolicy.negate(),
        menu: {
            id: MenuId.ChatModePicker,
            when: disabled ? ChatContextKeys.Modes.agentModeDisabledByPolicy : ChatContextKeys.Modes.agentModeDisabledByPolicy.negate(),
        },
    };
    return config;
}
class PickerConfigAgentAction extends ConfigAgentActionImpl {
    constructor() { super(createPickerConfigureAgentsActionConfig(false)); }
}
class PickerConfigAgentActionDisabled extends ConfigAgentActionImpl {
    constructor() { super(createPickerConfigureAgentsActionConfig(true)); }
}
/**
 * Action ID for the `Configure Custom Agents` action.
 */
const CONFIGURE_AGENTS_ACTION_ID = 'workbench.action.chat.configure.customagents';
function createManageAgentsActionConfig(disabled) {
    const base = {
        id: disabled ? CONFIGURE_AGENTS_ACTION_ID + '.disabled' : CONFIGURE_AGENTS_ACTION_ID,
        title: localize2('configure-agents', "Configure Custom Agents..."),
        shortTitle: localize('configure-agents.short', "Custom Agents"),
        icon: disabled ? Codicon.lock : Codicon.bookmark,
        f1: !disabled,
        precondition: disabled ? ContextKeyExpr.false() : ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.Modes.agentModeDisabledByPolicy.negate()),
        category: CHAT_CATEGORY,
        menu: [
            {
                id: CHAT_CONFIG_MENU_ID,
                when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals('view', ChatViewId), disabled ? ChatContextKeys.Modes.agentModeDisabledByPolicy : ChatContextKeys.Modes.agentModeDisabledByPolicy.negate()),
                order: 10,
                group: '0_level'
            }
        ]
    };
    return disabled ? { ...base, tooltip: localize('managedByOrganization', "Managed by your organization") } : base;
}
class ManageAgentsAction extends ConfigAgentActionImpl {
    constructor() { super(createManageAgentsActionConfig(false)); }
}
class ManageAgentsActionDisabled extends ConfigAgentActionImpl {
    constructor() { super(createManageAgentsActionConfig(true)); }
}
/**
 * Helper to register all the `Run Current Prompt` actions.
 */
export function registerAgentActions() {
    registerAction2(ManageAgentsAction);
    registerAction2(ManageAgentsActionDisabled);
    registerAction2(PickerConfigAgentAction);
    registerAction2(PickerConfigAgentActionDisabled);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9wcm9tcHRTeW50YXgvY2hhdE1vZGVBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxhQUFhLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMvRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFbkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDckcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDeEMsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUVqRixNQUFlLHFCQUFzQixTQUFRLE9BQU87SUFDbkMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUEwQjtRQUNuRCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDekQsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNu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