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
import { $ } from '../../../../../base/browser/dom.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { markAsSingleton } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { MenuEntryActionViewItem } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { Action2, MenuId, MenuItemAction, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { registerWorkbenchContribution2 } from '../../../../common/contributions.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { isResponseVM } from '../../common/chatViewModel.js';
import { ChatModeKind } from '../../common/constants.js';
import { IChatWidgetService } from '../chat.js';
import { ToolsScope } from '../chatSelectedTools.js';
import { CHAT_CATEGORY } from './chatActions.js';
import { showToolsPicker } from './chatToolPicker.js';
export const AcceptToolConfirmationActionId = 'workbench.action.chat.acceptTool';
export const SkipToolConfirmationActionId = 'workbench.action.chat.skipTool';
export const AcceptToolPostConfirmationActionId = 'workbench.action.chat.acceptToolPostExecution';
export const SkipToolPostConfirmationActionId = 'workbench.action.chat.skipToolPostExecution';
class ToolConfirmationAction extends Action2 {
    run(accessor, ...args) {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = chatWidgetService.lastFocusedWidget;
        const lastItem = widget?.viewModel?.getItems().at(-1);
        if (!isResponseVM(lastItem)) {
            return;
        }
        for (const item of lastItem.model.response.value) {
            const state = item.kind === 'toolInvocation' ? item.state.get() : undefined;
            if (state?.type === 0 /* IChatToolInvocation.StateKind.WaitingForConfirmation */ || state?.type === 2 /* IChatToolInvocation.StateKind.WaitingForPostApproval */) {
                state.confirm(this.getReason());
                break;
            }
        }
        // Return focus to the chat input, in case it was in the tool confirmation editor
        widget?.focusInput();
    }
}
class AcceptToolConfirmation extends ToolConfirmationAction {
    constructor() {
        super({
            id: AcceptToolConfirmationActionId,
            title: localize2('chat.accept', "Accept"),
            f1: false,
            category: CHAT_CATEGORY,
            keybinding: {
                when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.Editing.hasToolConfirmation),
                primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
                // Override chatEditor.action.accept
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
            },
        });
    }
    getReason() {
        return { type: 4 /* ToolConfirmKind.UserAction */ };
    }
}
class SkipToolConfirmation extends ToolConfirmationAction {
    constructor() {
        super({
            id: SkipToolConfirmationActionId,
            title: localize2('chat.skip', "Skip"),
            f1: false,
            category: CHAT_CATEGORY,
            keybinding: {
                when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.Editing.hasToolConfirmation),
                primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */ | 512 /* KeyMod.Alt */,
                // Override chatEditor.action.accept
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
            },
        });
    }
    getReason() {
        return { type: 5 /* ToolConfirmKind.Skipped */ };
    }
}
class ConfigureToolsAction extends Action2 {
    static { this.ID = 'workbench.action.chat.configureTools'; }
    constructor() {
        super({
            id: ConfigureToolsAction.ID,
            title: localize('label', "Configure Tools..."),
            icon: Codicon.tools,
            f1: false,
            category: CHAT_CATEGORY,
            precondition: ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent),
            menu: [{
                    when: ContextKeyExpr.and(ChatContextKeys.chatModeKind.isEqualTo(ChatModeKind.Agent), ChatContextKeys.lockedToCodingAgent.negate()),
                    id: MenuId.ChatInput,
                    group: 'navigation',
                    order: 100,
                }]
        });
    }
    async run(accessor, ...args) {
        const instaService = accessor.get(IInstantiationService);
        const chatWidgetService = accessor.get(IChatWidgetService);
        const telemetryService = accessor.get(ITelemetryService);
        let widget = chatWidgetService.lastFocusedWidget;
        if (!widget) {
            function isChatActionContext(obj) {
                return !!obj && typeof obj === 'object' && !!obj.widget;
            }
            const context = args[0];
            if (isChatActionContext(context)) {
                widget = context.widget;
            }
        }
        if (!widget) {
            return;
        }
        let placeholder;
        let description;
        const { entriesScope, entriesMap } = widget.input.selectedToolsModel;
        switch (entriesScope) {
            case ToolsScope.Session:
                placeholder = localize('chat.tools.placeholder.session', "Select tools for this chat session");
                description = localize('chat.tools.description.session', "The selected tools were configured only for this chat session.");
                break;
            case ToolsScope.Agent:
                placeholder = localize('chat.tools.placeholder.agent', "Select tools for this custom agent");
                description = localize('chat.tools.description.agent', "The selected tools are configured by the '{0}' custom agent. Changes to the tools will be applied to the custom agent file as well.", widget.input.currentModeObs.get().label.get());
                break;
            case ToolsScope.Agent_ReadOnly:
                placeholder = localize('chat.tools.placeholder.readOnlyAgent', "Select tools for this custom agent");
                description = localize('chat.tools.description.readOnlyAgent', "The selected tools are configured by the '{0}' custom agent. Changes to the tools will only be used for this session and will not change the '{0}' custom agent.", widget.input.currentModeObs.get().label.get());
                break;
            case ToolsScope.Global:
                placeholder = localize('chat.tools.placeholder.global', "Select tools that are available to chat.");
                description = localize('chat.tools.description.global', "The selected tools will be applied globally for all chat sessions that use the default agent.");
                break;
        }
        const result = await instaService.invokeFunction(showToolsPicker, placeholder, description, () => entriesMap.get());
        if (result) {
            widget.input.selectedToolsModel.set(result, false);
        }
        const tools = widget.input.selectedToolsModel.entriesMap.get();
        telemetryService.publicLog2('chat/selectedTools', {
            total: tools.size,
            enabled: Iterable.reduce(tools, (prev, [_, enabled]) => enabled ? prev + 1 : prev, 0),
        });
    }
}
let ConfigureToolsActionRendering = class ConfigureToolsActionRendering {
    static { this.ID = 'chat.configureToolsActionRendering'; }
    constructor(actionViewItemService) {
        const disposable = actionViewItemService.register(MenuId.ChatInput, ConfigureToolsAction.ID, (action, _opts, instantiationService) => {
            if (!(action instanceof MenuItemAction)) {
                return undefined;
            }
            return instantiationService.createInstance(class extends MenuEntryActionViewItem {
                render(container) {
                    super.render(container);
                    // Add warning indicator element
                    this.warningElement = $(`.tool-warning-indicator${ThemeIcon.asCSSSelector(Codicon.warning)}`);
                    this.warningElement.style.display = 'none';
                    container.appendChild(this.warningElement);
                    container.style.position = 'relative';
                    // Set up context key listeners
                    this.updateWarningState();
                    this._register(this._contextKeyService.onDidChangeContext(() => {
                        this.updateWarningState();
                    }));
                }
                updateWarningState() {
                    const wasShown = this.warningElement.style.display === 'block';
                    const shouldBeShown = this.isAboveToolLimit();
                    if (!wasShown && shouldBeShown) {
                        this.warningElement.style.display = 'block';
                        this.updateTooltip();
                    }
                    else if (wasShown && !shouldBeShown) {
                        this.warningElement.style.display = 'none';
                        this.updateTooltip();
                    }
                }
                getTooltip() {
                    if (this.isAboveToolLimit()) {
                        const warningMessage = localize('chatTools.tooManyEnabled', 'More than {0} tools are enabled, you may experience degraded tool calling.', this._contextKeyService.getContextKeyValue(ChatContextKeys.chatToolGroupingThreshold.key));
                        return `${warningMessage}`;
                    }
                    return super.getTooltip();
                }
                isAboveToolLimit() {
                    const rawToolLimit = this._contextKeyService.getContextKeyValue(ChatContextKeys.chatToolGroupingThreshold.key);
                    const rawToolCount = this._contextKeyService.getContextKeyValue(ChatContextKeys.chatToolCount.key);
                    if (rawToolLimit === undefined || rawToolCount === undefined) {
                        return false;
                    }
                    const toolLimit = Number(rawToolLimit || 0);
                    const toolCount = Number(rawToolCount || 0);
                    return toolCount > toolLimit;
                }
            }, action, undefined);
        });
        // Reduces flicker a bit on reload/restart
        markAsSingleton(disposable);
    }
};
ConfigureToolsActionRendering = __decorate([
    __param(0, IActionViewItemService)
], ConfigureToolsActionRendering);
export function registerChatToolActions() {
    registerAction2(AcceptToolConfirmation);
    registerAction2(SkipToolConfirmation);
    registerAction2(ConfigureToolsAction);
    registerWorkbenchContribution2(ConfigureToolsActionRendering.ID, ConfigureToolsActionRendering, 2 /* WorkbenchPhase.BlockRestore */);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRUb29sQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdkQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVsRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXBFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDMUcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sb0VBQW9FLENBQUM7QUFDN0csT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3JILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRixPQUFPLEVBQTBCLDhCQUE4QixFQUFrQixNQUFNLHFDQUFxQyxDQUFDO0FBQzdILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUVsRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0JBQStC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