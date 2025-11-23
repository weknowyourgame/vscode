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
var CommandsQuickAccessProvider_1;
import { isFirefox } from '../../../../base/browser/browser.js';
import { raceTimeout, timeout } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { stripIcons } from '../../../../base/common/iconLabels.js';
import { Language } from '../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { AbstractEditorCommandsQuickAccessProvider } from '../../../../editor/contrib/quickAccess/browser/commandsQuickAccess.js';
import { localize, localize2 } from '../../../../nls.js';
import { isLocalizedString } from '../../../../platform/action/common/action.js';
import { Action2, IMenuService, MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { CommandsHistory } from '../../../../platform/quickinput/browser/commandsQuickAccess.js';
import { TriggerAction } from '../../../../platform/quickinput/browser/pickerQuickAccess.js';
import { DefaultQuickAccessFilterValue } from '../../../../platform/quickinput/common/quickAccess.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IAiRelatedInformationService, RelatedInformationType } from '../../../services/aiRelatedInformation/common/aiRelatedInformation.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { createKeybindingCommandQuery } from '../../../services/preferences/browser/keybindingsEditorModel.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { CHAT_OPEN_ACTION_ID } from '../../chat/browser/actions/chatActions.js';
import { ASK_QUICK_QUESTION_ACTION_ID } from '../../chat/browser/actions/chatQuickInputActions.js';
import { IChatAgentService } from '../../chat/common/chatAgents.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
let CommandsQuickAccessProvider = class CommandsQuickAccessProvider extends AbstractEditorCommandsQuickAccessProvider {
    static { CommandsQuickAccessProvider_1 = this; }
    static { this.AI_RELATED_INFORMATION_MAX_PICKS = 5; }
    static { this.AI_RELATED_INFORMATION_DEBOUNCE = 200; }
    get activeTextEditorControl() { return this.editorService.activeTextEditorControl; }
    get defaultFilterValue() {
        if (this.configuration.preserveInput) {
            return DefaultQuickAccessFilterValue.LAST;
        }
        return undefined;
    }
    constructor(editorService, menuService, extensionService, instantiationService, keybindingService, commandService, telemetryService, dialogService, configurationService, editorGroupService, preferencesService, productService, aiRelatedInformationService, chatAgentService) {
        super({
            showAlias: !Language.isDefaultVariant(),
            noResultsPick: () => ({
                label: localize('noCommandResults', "No matching commands"),
                commandId: ''
            }),
        }, instantiationService, keybindingService, commandService, telemetryService, dialogService);
        this.editorService = editorService;
        this.menuService = menuService;
        this.configurationService = configurationService;
        this.editorGroupService = editorGroupService;
        this.preferencesService = preferencesService;
        this.productService = productService;
        this.aiRelatedInformationService = aiRelatedInformationService;
        this.chatAgentService = chatAgentService;
        this.useAiRelatedInfo = false;
        this.extensionRegistrationRace = raceTimeout(extensionService.whenInstalledExtensionsRegistered(), 800);
        this._register(configurationService.onDidChangeConfiguration((e) => this.updateOptions(e)));
        this.updateOptions();
    }
    get configuration() {
        const commandPaletteConfig = this.configurationService.getValue().workbench.commandPalette;
        return {
            preserveInput: commandPaletteConfig.preserveInput,
            showAskInChat: commandPaletteConfig.showAskInChat,
            experimental: commandPaletteConfig.experimental
        };
    }
    updateOptions(e) {
        if (e && !e.affectsConfiguration('workbench.commandPalette.experimental')) {
            return;
        }
        const config = this.configuration;
        const suggestedCommandIds = config.experimental.suggestCommands && this.productService.commandPaletteSuggestedCommandIds?.length
            ? new Set(this.productService.commandPaletteSuggestedCommandIds)
            : undefined;
        this.options.suggestedCommandIds = suggestedCommandIds;
        this.useAiRelatedInfo = config.experimental.enableNaturalLanguageSearch;
    }
    async getCommandPicks(token) {
        // wait for extensions registration or 800ms once
        await this.extensionRegistrationRace;
        if (token.isCancellationRequested) {
            return [];
        }
        return [
            ...this.getCodeEditorCommandPicks(),
            ...this.getGlobalCommandPicks()
        ].map(picks => ({
            ...picks,
            buttons: [{
                    iconClass: ThemeIcon.asClassName(Codicon.gear),
                    tooltip: localize('configure keybinding', "Configure Keybinding"),
                }],
            trigger: () => {
                this.preferencesService.openGlobalKeybindingSettings(false, { query: createKeybindingCommandQuery(picks.commandId, picks.commandWhen) });
                return TriggerAction.CLOSE_PICKER;
            },
        }));
    }
    hasAdditionalCommandPicks(filter, token) {
        if (!this.useAiRelatedInfo
            || token.isCancellationRequested
            || filter === ''
            || !this.aiRelatedInformationService.isEnabled()) {
            return false;
        }
        return true;
    }
    async getAdditionalCommandPicks(allPicks, picksSoFar, filter, token) {
        if (!this.hasAdditionalCommandPicks(filter, token)) {
            return [];
        }
        let additionalPicks = [];
        try {
            // Wait a bit to see if the user is still typing
            await timeout(CommandsQuickAccessProvider_1.AI_RELATED_INFORMATION_DEBOUNCE, token);
            additionalPicks = await this.getRelatedInformationPicks(allPicks, picksSoFar, filter, token);
        }
        catch (e) {
            // Ignore and continue to add "Ask in Chat" option
        }
        // If enabled in settings, add "Ask in Chat" option after a separator (if needed).
        if (this.configuration.showAskInChat) {
            const defaultAgent = this.chatAgentService.getDefaultAgent(ChatAgentLocation.Chat);
            if (defaultAgent) {
                if (picksSoFar.length || additionalPicks.length) {
                    additionalPicks.push({
                        type: 'separator'
                    });
                }
                additionalPicks.push({
                    label: localize('commandsQuickAccess.askInChat', "Ask in Chat: {0}", filter),
                    commandId: this.configuration.experimental.askChatLocation === 'quickChat' ? ASK_QUICK_QUESTION_ACTION_ID : CHAT_OPEN_ACTION_ID,
                    args: [filter],
                    buttons: [{
                            iconClass: ThemeIcon.asClassName(Codicon.gear),
                            tooltip: localize('commandsQuickAccess.configureAskInChatSetting', "Configure visibility"),
                        }],
                    trigger: () => {
                        void this.preferencesService.openSettings({ jsonEditor: false, query: 'workbench.commandPalette.showAskInChat' });
                        return TriggerAction.CLOSE_PICKER;
                    },
                });
            }
        }
        return additionalPicks;
    }
    async getRelatedInformationPicks(allPicks, picksSoFar, filter, token) {
        const relatedInformation = await this.aiRelatedInformationService.getRelatedInformation(filter, [RelatedInformationType.CommandInformation], token);
        // Sort by weight descending to get the most relevant results first
        relatedInformation.sort((a, b) => b.weight - a.weight);
        const setOfPicksSoFar = new Set(picksSoFar.map(p => p.commandId));
        const additionalPicks = new Array();
        for (const info of relatedInformation) {
            if (additionalPicks.length === CommandsQuickAccessProvider_1.AI_RELATED_INFORMATION_MAX_PICKS) {
                break;
            }
            const pick = allPicks.find(p => p.commandId === info.command && !setOfPicksSoFar.has(p.commandId));
            if (pick) {
                additionalPicks.push(pick);
            }
        }
        return additionalPicks;
    }
    getGlobalCommandPicks() {
        const globalCommandPicks = [];
        const scopedContextKeyService = this.editorService.activeEditorPane?.scopedContextKeyService || this.editorGroupService.activeGroup.scopedContextKeyService;
        const globalCommandsMenu = this.menuService.getMenuActions(MenuId.CommandPalette, scopedContextKeyService);
        const globalCommandsMenuActions = globalCommandsMenu
            .reduce((r, [, actions]) => [...r, ...actions], [])
            .filter(action => action instanceof MenuItemAction && action.enabled);
        for (const action of globalCommandsMenuActions) {
            // Label
            let label = (typeof action.item.title === 'string' ? action.item.title : action.item.title.value) || action.item.id;
            // Category
            const category = typeof action.item.category === 'string' ? action.item.category : action.item.category?.value;
            if (category) {
                label = localize('commandWithCategory', "{0}: {1}", category, label);
            }
            // Alias
            const aliasLabel = typeof action.item.title !== 'string' ? action.item.title.original : undefined;
            const aliasCategory = (category && action.item.category && typeof action.item.category !== 'string') ? action.item.category.original : undefined;
            const commandAlias = (aliasLabel && category) ?
                aliasCategory ? `${aliasCategory}: ${aliasLabel}` : `${category}: ${aliasLabel}` :
                aliasLabel;
            const metadataDescription = action.item.metadata?.description;
            const commandDescription = metadataDescription === undefined || isLocalizedString(metadataDescription)
                ? metadataDescription
                // TODO: this type will eventually not be a string and when that happens, this should simplified.
                : { value: metadataDescription, original: metadataDescription };
            globalCommandPicks.push({
                commandId: action.item.id,
                commandWhen: action.item.precondition?.serialize(),
                commandAlias,
                label: stripIcons(label),
                commandDescription,
                commandCategory: category,
            });
        }
        return globalCommandPicks;
    }
};
CommandsQuickAccessProvider = CommandsQuickAccessProvider_1 = __decorate([
    __param(0, IEditorService),
    __param(1, IMenuService),
    __param(2, IExtensionService),
    __param(3, IInstantiationService),
    __param(4, IKeybindingService),
    __param(5, ICommandService),
    __param(6, ITelemetryService),
    __param(7, IDialogService),
    __param(8, IConfigurationService),
    __param(9, IEditorGroupsService),
    __param(10, IPreferencesService),
    __param(11, IProductService),
    __param(12, IAiRelatedInformationService),
    __param(13, IChatAgentService)
], CommandsQuickAccessProvider);
export { CommandsQuickAccessProvider };
//#region Actions
export class ShowAllCommandsAction extends Action2 {
    static { this.ID = 'workbench.action.showCommands'; }
    constructor() {
        super({
            id: ShowAllCommandsAction.ID,
            title: localize2('showTriggerActions', 'Show All Commands'),
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: undefined,
                primary: !isFirefox ? (2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 46 /* KeyCode.KeyP */) : undefined,
                secondary: [59 /* KeyCode.F1 */]
            },
            f1: true
        });
    }
    async run(accessor) {
        accessor.get(IQuickInputService).quickAccess.show(CommandsQuickAccessProvider.PREFIX);
    }
}
export class ClearCommandHistoryAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.clearCommandHistory',
            title: localize2('clearCommandHistory', 'Clear Command History'),
            f1: true
        });
    }
    async run(accessor) {
        const configurationService = accessor.get(IConfigurationService);
        const storageService = accessor.get(IStorageService);
        const dialogService = accessor.get(IDialogService);
        const commandHistoryLength = CommandsHistory.getConfiguredCommandHistoryLength(configurationService);
        if (commandHistoryLength > 0) {
            // Ask for confirmation
            const { confirmed } = await dialogService.confirm({
                type: 'warning',
                message: localize('confirmClearMessage', "Do you want to clear the history of recently used commands?"),
                detail: localize('confirmClearDetail', "This action is irreversible!"),
                primaryButton: localize({ key: 'clearButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Clear")
            });
            if (!confirmed) {
                return;
            }
            CommandsHistory.clearHistory(configurationService, storageService);
        }
    }
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZHNRdWlja0FjY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9xdWlja2FjY2Vzcy9icm93c2VyL2NvbW1hbmRzUXVpY2tBY2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRXhFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFbkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVqRSxPQUFPLEVBQUUseUNBQXlDLEVBQUUsTUFBTSx1RUFBdUUsQ0FBQztBQUNsSSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQXFCLE1BQU0sZ0RBQWdELENBQUM7QUFDbEksT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBNkIscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUM5SCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLDREQUE0RCxDQUFDO0FBQ3JILE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsZUFBZSxFQUFxQixNQUFNLGdFQUFnRSxDQUFDO0FBQ3BILE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUM3RixPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsa0JBQWtCLEVBQXVCLE1BQU0sc0RBQXNELENBQUM7QUFDL0csT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRXZGLE9BQU8sRUFBNEIsNEJBQTRCLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSx1RUFBdUUsQ0FBQztBQUN2SyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM5RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDL0csT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDMUYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDaEYsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbkcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFNUQsSUFBTSwyQkFBMkIsR0FBakMsTUFBTSwyQkFBNEIsU0FBUSx5Q0FBeUM7O2FBRTFFLHFDQUFnQyxHQUFHLENBQUMsQUFBSixDQUFLO2FBQ3JDLG9DQUErQixHQUFHLEdBQUcsQUFBTixDQUFPO0lBVXJELElBQWMsdUJBQXVCLEtBQTBCLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUM7SUFFbkgsSUFBSSxrQkFBa0I7UUFDckIsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3RDLE9BQU8sNkJBQTZCLENBQUMsSUFBSSxDQUFDO1FBQzNDLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsWUFDaUIsYUFBOEMsRUFDaEQsV0FBMEMsRUFDckMsZ0JBQW1DLEVBQy9CLG9CQUEyQyxFQUM5QyxpQkFBcUMsRUFDeEMsY0FBK0IsRUFDN0IsZ0JBQW1DLEVBQ3RDLGFBQTZCLEVBQ3RCLG9CQUE0RCxFQUM3RCxrQkFBeUQsRUFDMUQsa0JBQXdELEVBQzVELGNBQWdELEVBQ25DLDJCQUEwRSxFQUNyRixnQkFBb0Q7UUFFdkUsS0FBSyxDQUFDO1lBQ0wsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFO1lBQ3ZDLGFBQWEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO2dCQUNyQixLQUFLLEVBQUUsUUFBUSxDQUFDLGtCQUFrQixFQUFFLHNCQUFzQixDQUFDO2dCQUMzRCxTQUFTLEVBQUUsRUFBRTthQUNiLENBQUM7U0FDRixFQUFFLG9CQUFvQixFQUFFLGlCQUFpQixFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLENBQUMsQ0FBQztRQXJCNUQsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQy9CLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBT2hCLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFDNUMsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFzQjtRQUN6Qyx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXFCO1FBQzNDLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUNsQixnQ0FBMkIsR0FBM0IsMkJBQTJCLENBQThCO1FBQ3BFLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUExQmhFLHFCQUFnQixHQUFHLEtBQUssQ0FBQztRQW9DaEMsSUFBSSxDQUFDLHlCQUF5QixHQUFHLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxpQ0FBaUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3hHLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVGLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN0QixDQUFDO0lBRUQsSUFBWSxhQUFhO1FBQ3hCLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsRUFBc0MsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDO1FBRS9ILE9BQU87WUFDTixhQUFhLEVBQUUsb0JBQW9CLENBQUMsYUFBYTtZQUNqRCxhQUFhLEVBQUUsb0JBQW9CLENBQUMsYUFBYTtZQUNqRCxZQUFZLEVBQUUsb0JBQW9CLENBQUMsWUFBWTtTQUMvQyxDQUFDO0lBQ0gsQ0FBQztJQUVPLGFBQWEsQ0FBQyxDQUE2QjtRQUNsRCxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyx1Q0FBdUMsQ0FBQyxFQUFFLENBQUM7WUFDM0UsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQ2xDLE1BQU0sbUJBQW1CLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxpQ0FBaUMsRUFBRSxNQUFNO1lBQy9ILENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGlDQUFpQyxDQUFDO1lBQ2hFLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDYixJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixHQUFHLG1CQUFtQixDQUFDO1FBQ3ZELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLDJCQUEyQixDQUFDO0lBQ3pFLENBQUM7SUFFUyxLQUFLLENBQUMsZUFBZSxDQUFDLEtBQXdCO1FBRXZELGlEQUFpRDtRQUNqRCxNQUFNLElBQUksQ0FBQyx5QkFBeUIsQ0FBQztRQUVyQyxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ25DLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELE9BQU87WUFDTixHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRTtZQUNuQyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRTtTQUMvQixDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDZixHQUFHLEtBQUs7WUFDUixPQUFPLEVBQUUsQ0FBQztvQkFDVCxTQUFTLEVBQUUsU0FBUyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO29CQUM5QyxPQUFPLEVBQUUsUUFBUSxDQUFDLHNCQUFzQixFQUFFLHNCQUFzQixDQUFDO2lCQUNqRSxDQUFDO1lBQ0YsT0FBTyxFQUFFLEdBQWtCLEVBQUU7Z0JBQzVCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyw0QkFBNEIsQ0FBQyxLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsNEJBQTRCLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUN6SSxPQUFPLGFBQWEsQ0FBQyxZQUFZLENBQUM7WUFDbkMsQ0FBQztTQUNELENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVTLHlCQUF5QixDQUFDLE1BQWMsRUFBRSxLQUF3QjtRQUMzRSxJQUNDLENBQUMsSUFBSSxDQUFDLGdCQUFnQjtlQUNuQixLQUFLLENBQUMsdUJBQXVCO2VBQzdCLE1BQU0sS0FBSyxFQUFFO2VBQ2IsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsU0FBUyxFQUFFLEVBQy9DLENBQUM7WUFDRixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFUyxLQUFLLENBQUMseUJBQXlCLENBQUMsUUFBNkIsRUFBRSxVQUErQixFQUFFLE1BQWMsRUFBRSxLQUF3QjtRQUNqSixJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BELE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELElBQUksZUFBZSxHQUFnRCxFQUFFLENBQUM7UUFDdEUsSUFBSSxDQUFDO1lBQ0osZ0RBQWdEO1lBQ2hELE1BQU0sT0FBTyxDQUFDLDZCQUEyQixDQUFDLCtCQUErQixFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ2xGLGVBQWUsR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM5RixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNaLGtEQUFrRDtRQUNuRCxDQUFDO1FBRUQsa0ZBQWtGO1FBQ2xGLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN0QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25GLElBQUksWUFBWSxFQUFFLENBQUM7Z0JBQ2xCLElBQUksVUFBVSxDQUFDLE1BQU0sSUFBSSxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ2pELGVBQWUsQ0FBQyxJQUFJLENBQUM7d0JBQ3BCLElBQUksRUFBRSxXQUFXO3FCQUNqQixDQUFDLENBQUM7Z0JBQ0osQ0FBQztnQkFFRCxlQUFlLENBQUMsSUFBSSxDQUFDO29CQUNwQixLQUFLLEVBQUUsUUFBUSxDQUFDLCtCQUErQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sQ0FBQztvQkFDNUUsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLGVBQWUsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLDRCQUE0QixDQUFDLENBQUMsQ0FBQyxtQkFBbUI7b0JBQy9ILElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQztvQkFDZCxPQUFPLEVBQUUsQ0FBQzs0QkFDVCxTQUFTLEVBQUUsU0FBUyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDOzRCQUM5QyxPQUFPLEVBQUUsUUFBUSxDQUFDLCtDQUErQyxFQUFFLHNCQUFzQixDQUFDO3lCQUMxRixDQUFDO29CQUNGLE9BQU8sRUFBRSxHQUFHLEVBQUU7d0JBQ2IsS0FBSyxJQUFJLENBQUMsa0JBQWtCLENBQUMsWUFBWSxDQUFDLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsd0NBQXdDLEVBQUUsQ0FBQyxDQUFDO3dCQUNsSCxPQUFPLGFBQWEsQ0FBQyxZQUFZLENBQUM7b0JBQ25DLENBQUM7aUJBQ0QsQ0FBQyxDQUFDO1lBQ0osQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLGVBQWUsQ0FBQztJQUN4QixDQUFDO0lBRU8sS0FBSyxDQUFDLDBCQUEwQixDQUFDLFFBQTZCLEVBQUUsVUFBK0IsRUFBRSxNQUFjLEVBQUUsS0FBd0I7UUFDaEosTUFBTSxrQkFBa0IsR0FBRyxNQUFNLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxxQkFBcUIsQ0FDdEYsTUFBTSxFQUNOLENBQUMsc0JBQXNCLENBQUMsa0JBQWtCLENBQUMsRUFDM0MsS0FBSyxDQUN5QixDQUFDO1FBRWhDLG1FQUFtRTtRQUNuRSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUV2RCxNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDbEUsTUFBTSxlQUFlLEdBQUcsSUFBSSxLQUFLLEVBQTJDLENBQUM7UUFFN0UsS0FBSyxNQUFNLElBQUksSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1lBQ3ZDLElBQUksZUFBZSxDQUFDLE1BQU0sS0FBSyw2QkFBMkIsQ0FBQyxnQ0FBZ0MsRUFBRSxDQUFDO2dCQUM3RixNQUFNO1lBQ1AsQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ25HLElBQUksSUFBSSxFQUFFLENBQUM7Z0JBQ1YsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM1QixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sZUFBZSxDQUFDO0lBQ3hCLENBQUM7SUFFTyxxQkFBcUI7UUFDNUIsTUFBTSxrQkFBa0IsR0FBd0IsRUFBRSxDQUFDO1FBQ25ELE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsRUFBRSx1QkFBdUIsSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLHVCQUF1QixDQUFDO1FBQzVKLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1FBQzNHLE1BQU0seUJBQXlCLEdBQUcsa0JBQWtCO2FBQ2xELE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxPQUFPLENBQUMsRUFBc0QsRUFBRSxDQUFDO2FBQ3RHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sWUFBWSxjQUFjLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBcUIsQ0FBQztRQUUzRixLQUFLLE1BQU0sTUFBTSxJQUFJLHlCQUF5QixFQUFFLENBQUM7WUFFaEQsUUFBUTtZQUNSLElBQUksS0FBSyxHQUFHLENBQUMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUVwSCxXQUFXO1lBQ1gsTUFBTSxRQUFRLEdBQUcsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUM7WUFDL0csSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDZCxLQUFLLEdBQUcsUUFBUSxDQUFDLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdEUsQ0FBQztZQUVELFFBQVE7WUFDUixNQUFNLFVBQVUsR0FBRyxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDbEcsTUFBTSxhQUFhLEdBQUcsQ0FBQyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDakosTUFBTSxZQUFZLEdBQUcsQ0FBQyxVQUFVLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDOUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLGFBQWEsS0FBSyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLEtBQUssVUFBVSxFQUFFLENBQUMsQ0FBQztnQkFDbEYsVUFBVSxDQUFDO1lBRVosTUFBTSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUM7WUFDOUQsTUFBTSxrQkFBa0IsR0FBRyxtQkFBbUIsS0FBSyxTQUFTLElBQUksaUJBQWlCLENBQUMsbUJBQW1CLENBQUM7Z0JBQ3JHLENBQUMsQ0FBQyxtQkFBbUI7Z0JBQ3JCLGlHQUFpRztnQkFDakcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxtQkFBbUIsRUFBRSxDQUFDO1lBQ2pFLGtCQUFrQixDQUFDLElBQUksQ0FBQztnQkFDdkIsU0FBUyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDekIsV0FBVyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRTtnQkFDbEQsWUFBWTtnQkFDWixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQztnQkFDeEIsa0JBQWtCO2dCQUNsQixlQUFlLEVBQUUsUUFBUTthQUN6QixDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsT0FBTyxrQkFBa0IsQ0FBQztJQUMzQixDQUFDOztBQWhPVywyQkFBMkI7SUF3QnJDLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxrQkFBa0IsQ0FBQTtJQUNsQixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsV0FBQSxjQUFjLENBQUE7SUFDZCxXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsb0JBQW9CLENBQUE7SUFDcEIsWUFBQSxtQkFBbUIsQ0FBQTtJQUNuQixZQUFBLGVBQWUsQ0FBQTtJQUNmLFlBQUEsNEJBQTRCLENBQUE7SUFDNUIsWUFBQSxpQkFBaUIsQ0FBQTtHQXJDUCwyQkFBMkIsQ0FpT3ZDOztBQUVELGlCQUFpQjtBQUVqQixNQUFNLE9BQU8scUJBQXNCLFNBQVEsT0FBTzthQUVqQyxPQUFFLEdBQUcsK0JBQStCLENBQUM7SUFFckQ7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUscUJBQXFCLENBQUMsRUFBRTtZQUM1QixLQUFLLEVBQUUsU0FBUyxDQUFDLG9CQUFvQixFQUFFLG1CQUFtQixDQUFDO1lBQzNELFVBQVUsRUFBRTtnQkFDWCxNQUFNLDZDQUFtQztnQkFDekMsSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsT0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLG1EQUE2Qix3QkFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7Z0JBQ2hGLFNBQVMsRUFBRSxxQkFBWTthQUN2QjtZQUNELEVBQUUsRUFBRSxJQUFJO1NBQ1IsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEI7UUFDbkMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdkYsQ0FBQzs7QUFHRixNQUFNLE9BQU8seUJBQTBCLFNBQVEsT0FBTztJQUVyRDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSxzQ0FBc0M7WUFDMUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRSx1QkFBdUIsQ0FBQztZQUNoRSxFQUFFLEVBQUUsSUFBSTtTQUNSLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQTBCO1FBQ25DLE1BQU0sb0JBQW9CLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDckQsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVuRCxNQUFNLG9CQUFvQixHQUFHLGVBQWUsQ0FBQyxpQ0FBaUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3JHLElBQUksb0JBQW9CLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFFOUIsdUJBQXVCO1lBQ3ZCLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxNQUFNLGFBQWEsQ0FBQyxPQUFPLENBQUM7Z0JBQ2pELElBQUksRUFBRSxTQUFTO2dCQUNmLE9BQU8sRUFBRSxRQUFRLENBQUMscUJBQXFCLEVBQUUsNkRBQTZELENBQUM7Z0JBQ3ZHLE1BQU0sRUFBRSxRQUFRLENBQUMsb0JBQW9CLEVBQUUsOEJBQThCLENBQUM7Z0JBQ3RFLGFBQWEsRUFBRSxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQzthQUNuRyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2hCLE9BQU87WUFDUixDQUFDO1lBRUQsZUFBZSxDQUFDLFlBQVksQ0FBQyxvQkFBb0IsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUNwRSxDQUFDO0lBQ0YsQ0FBQztDQUNEO0FBRUQsWUFBWSJ9