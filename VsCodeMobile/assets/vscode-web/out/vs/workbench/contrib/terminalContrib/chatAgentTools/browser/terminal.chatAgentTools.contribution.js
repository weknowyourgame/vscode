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
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { isNumber } from '../../../../../base/common/types.js';
import { localize } from '../../../../../nls.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerWorkbenchContribution2 } from '../../../../common/contributions.js';
import { IChatWidgetService } from '../../../chat/browser/chat.js';
import { ChatContextKeys } from '../../../chat/common/chatContextKeys.js';
import { ILanguageModelToolsService } from '../../../chat/common/languageModelToolsService.js';
import { registerActiveInstanceAction, sharedWhenClause } from '../../../terminal/browser/terminalActions.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import { GetTerminalLastCommandTool, GetTerminalLastCommandToolData } from './tools/getTerminalLastCommandTool.js';
import { GetTerminalOutputTool, GetTerminalOutputToolData } from './tools/getTerminalOutputTool.js';
import { GetTerminalSelectionTool, GetTerminalSelectionToolData } from './tools/getTerminalSelectionTool.js';
import { ConfirmTerminalCommandTool, ConfirmTerminalCommandToolData } from './tools/runInTerminalConfirmationTool.js';
import { RunInTerminalTool, createRunInTerminalToolData } from './tools/runInTerminalTool.js';
import { CreateAndRunTaskTool, CreateAndRunTaskToolData } from './tools/task/createAndRunTaskTool.js';
import { GetTaskOutputTool, GetTaskOutputToolData } from './tools/task/getTaskOutputTool.js';
import { RunTaskTool, RunTaskToolData } from './tools/task/runTaskTool.js';
let ShellIntegrationTimeoutMigrationContribution = class ShellIntegrationTimeoutMigrationContribution extends Disposable {
    static { this.ID = 'terminal.shellIntegrationTimeoutMigration'; }
    constructor(configurationService) {
        super();
        const deprecatedSettingValue = configurationService.getValue("chat.tools.terminal.shellIntegrationTimeout" /* TerminalChatAgentToolsSettingId.ShellIntegrationTimeout */);
        if (!isNumber(deprecatedSettingValue)) {
            return;
        }
        const newSettingValue = configurationService.getValue("terminal.integrated.shellIntegration.timeout" /* TerminalSettingId.ShellIntegrationTimeout */);
        if (!isNumber(newSettingValue)) {
            configurationService.updateValue("terminal.integrated.shellIntegration.timeout" /* TerminalSettingId.ShellIntegrationTimeout */, deprecatedSettingValue);
        }
    }
};
ShellIntegrationTimeoutMigrationContribution = __decorate([
    __param(0, IConfigurationService)
], ShellIntegrationTimeoutMigrationContribution);
registerWorkbenchContribution2(ShellIntegrationTimeoutMigrationContribution.ID, ShellIntegrationTimeoutMigrationContribution, 4 /* WorkbenchPhase.Eventually */);
let ChatAgentToolsContribution = class ChatAgentToolsContribution extends Disposable {
    static { this.ID = 'terminal.chatAgentTools'; }
    constructor(instantiationService, toolsService) {
        super();
        // #region Terminal
        const confirmTerminalCommandTool = instantiationService.createInstance(ConfirmTerminalCommandTool);
        this._register(toolsService.registerTool(ConfirmTerminalCommandToolData, confirmTerminalCommandTool));
        const getTerminalOutputTool = instantiationService.createInstance(GetTerminalOutputTool);
        this._register(toolsService.registerTool(GetTerminalOutputToolData, getTerminalOutputTool));
        this._register(toolsService.executeToolSet.addTool(GetTerminalOutputToolData));
        instantiationService.invokeFunction(createRunInTerminalToolData).then(runInTerminalToolData => {
            const runInTerminalTool = instantiationService.createInstance(RunInTerminalTool);
            this._register(toolsService.registerTool(runInTerminalToolData, runInTerminalTool));
            this._register(toolsService.executeToolSet.addTool(runInTerminalToolData));
        });
        const getTerminalSelectionTool = instantiationService.createInstance(GetTerminalSelectionTool);
        this._register(toolsService.registerTool(GetTerminalSelectionToolData, getTerminalSelectionTool));
        const getTerminalLastCommandTool = instantiationService.createInstance(GetTerminalLastCommandTool);
        this._register(toolsService.registerTool(GetTerminalLastCommandToolData, getTerminalLastCommandTool));
        this._register(toolsService.readToolSet.addTool(GetTerminalSelectionToolData));
        this._register(toolsService.readToolSet.addTool(GetTerminalLastCommandToolData));
        // #endregion
        // #region Tasks
        const runTaskTool = instantiationService.createInstance(RunTaskTool);
        this._register(toolsService.registerTool(RunTaskToolData, runTaskTool));
        const getTaskOutputTool = instantiationService.createInstance(GetTaskOutputTool);
        this._register(toolsService.registerTool(GetTaskOutputToolData, getTaskOutputTool));
        const createAndRunTaskTool = instantiationService.createInstance(CreateAndRunTaskTool);
        this._register(toolsService.registerTool(CreateAndRunTaskToolData, createAndRunTaskTool));
        this._register(toolsService.executeToolSet.addTool(RunTaskToolData));
        this._register(toolsService.executeToolSet.addTool(GetTaskOutputToolData));
        this._register(toolsService.executeToolSet.addTool(CreateAndRunTaskToolData));
        // #endregion
    }
};
ChatAgentToolsContribution = __decorate([
    __param(0, IInstantiationService),
    __param(1, ILanguageModelToolsService)
], ChatAgentToolsContribution);
registerWorkbenchContribution2(ChatAgentToolsContribution.ID, ChatAgentToolsContribution, 3 /* WorkbenchPhase.AfterRestored */);
// #endregion Contributions
// #region Actions
registerActiveInstanceAction({
    id: "workbench.action.terminal.chat.addTerminalSelection" /* TerminalChatAgentToolsCommandId.ChatAddTerminalSelection */,
    title: localize('addTerminalSelection', 'Add Terminal Selection to Chat'),
    precondition: ContextKeyExpr.and(ChatContextKeys.enabled, sharedWhenClause.terminalAvailable),
    menu: [
        {
            id: MenuId.TerminalInstanceContext,
            group: "0_chat" /* TerminalContextMenuGroup.Chat */,
            order: 1,
            when: ContextKeyExpr.and(ChatContextKeys.enabled, TerminalContextKeys.textSelected)
        },
    ],
    run: async (activeInstance, _c, accessor) => {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const selection = activeInstance.selection;
        if (!selection) {
            return;
        }
        const chatView = chatWidgetService.lastFocusedWidget ?? await chatWidgetService.revealWidget();
        if (!chatView) {
            return;
        }
        chatView.attachmentModel.addContext({
            id: `terminal-selection-${Date.now()}`,
            kind: 'generic',
            name: localize('terminalSelection', 'Terminal Selection'),
            fullName: localize('terminalSelection', 'Terminal Selection'),
            value: selection,
            icon: Codicon.terminal
        });
        chatView.focusInput();
    }
});
// #endregion Actions
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuY2hhdEFnZW50VG9vbHMuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0QWdlbnRUb29scy9icm93c2VyL3Rlcm1pbmFsLmNoYXRBZ2VudFRvb2xzLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzNFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVBQUUsOEJBQThCLEVBQStDLE1BQU0scUNBQXFDLENBQUM7QUFDbEksT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbkUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQy9GLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRTlHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FB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