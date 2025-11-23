/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { coalesce } from '../../../../../base/common/arrays.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize2 } from '../../../../../nls.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ProductQualityContext } from '../../../../../platform/contextkey/common/contextkeys.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ILanguageModelsService } from '../../common/languageModels.js';
import { CHAT_CATEGORY } from './chatActions.js';
export class ManageModelsAction extends Action2 {
    static { this.ID = 'workbench.action.chat.manageLanguageModels'; }
    constructor() {
        super({
            id: ManageModelsAction.ID,
            title: localize2('manageLanguageModels', 'Manage Language Models...'),
            category: CHAT_CATEGORY,
            precondition: ContextKeyExpr.and(ProductQualityContext.isEqualTo('stable'), ChatContextKeys.enabled, ContextKeyExpr.or(ChatContextKeys.Entitlement.planFree, ChatContextKeys.Entitlement.planPro, ChatContextKeys.Entitlement.planProPlus, ChatContextKeys.Entitlement.internal)),
            f1: true
        });
    }
    async run(accessor, ...args) {
        const languageModelsService = accessor.get(ILanguageModelsService);
        const quickInputService = accessor.get(IQuickInputService);
        const commandService = accessor.get(ICommandService);
        const vendors = languageModelsService.getVendors();
        const store = new DisposableStore();
        const quickPickItems = vendors.sort((v1, v2) => v1.displayName.localeCompare(v2.displayName)).map(vendor => ({
            label: vendor.displayName,
            vendor: vendor.vendor,
            managementCommand: vendor.managementCommand,
            buttons: vendor.managementCommand ? [{
                    iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
                    tooltip: `Manage ${vendor.displayName}`
                }] : undefined
        }));
        const quickPick = store.add(quickInputService.createQuickPick());
        quickPick.title = 'Manage Language Models';
        quickPick.placeholder = 'Select a provider...';
        quickPick.items = quickPickItems;
        quickPick.show();
        store.add(quickPick.onDidAccept(async () => {
            quickPick.hide();
            const selectedItem = quickPick.selectedItems[0];
            if (selectedItem) {
                const models = coalesce((await languageModelsService.selectLanguageModels({ vendor: selectedItem.vendor }, true)).map(modelIdentifier => {
                    const modelMetadata = languageModelsService.lookupLanguageModel(modelIdentifier);
                    if (!modelMetadata) {
                        return undefined;
                    }
                    return {
                        metadata: modelMetadata,
                        identifier: modelIdentifier,
                    };
                })).sort((m1, m2) => m1.metadata.name.localeCompare(m2.metadata.name));
                await this.showModelSelectorQuickpick(models, quickInputService, languageModelsService);
            }
        }));
        store.add(quickPick.onDidTriggerItemButton(async (event) => {
            const selectedItem = event.item;
            const managementCommand = selectedItem.managementCommand;
            if (managementCommand) {
                commandService.executeCommand(managementCommand, selectedItem.vendor);
            }
        }));
        store.add(quickPick.onDidHide(() => {
            store.dispose();
        }));
    }
    async showModelSelectorQuickpick(modelsAndIdentifiers, quickInputService, languageModelsService) {
        const store = new DisposableStore();
        const modelItems = modelsAndIdentifiers.map(model => ({
            label: model.metadata.name,
            detail: model.metadata.id,
            modelId: model.identifier,
            vendor: model.metadata.vendor,
            picked: model.metadata.isUserSelectable
        }));
        if (modelItems.length === 0) {
            store.dispose();
            return;
        }
        const quickPick = quickInputService.createQuickPick();
        quickPick.items = modelItems;
        quickPick.title = 'Manage Language Models';
        quickPick.placeholder = 'Select language models...';
        quickPick.selectedItems = modelItems.filter(item => item.picked);
        quickPick.canSelectMany = true;
        quickPick.show();
        // Handle selection
        store.add(quickPick.onDidAccept(async () => {
            quickPick.hide();
            const items = quickPick.items;
            items.forEach(item => {
                languageModelsService.updateModelPickerPreference(item.modelId, quickPick.selectedItems.includes(item));
            });
        }));
        store.add(quickPick.onDidHide(() => {
            store.dispose();
        }));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlTW9kZWxzQWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9tYW5hZ2VNb2RlbHNBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDbEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDekYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFFakcsT0FBTyxFQUFFLGtCQUFrQixFQUFrQixNQUFNLHlEQUF5RCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNsRSxPQUFPLEVBQTJDLHNCQUFzQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDakgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBWWpELE1BQU0sT0FBTyxrQkFBbUIsU0FBUSxPQUFPO2FBQzlCLE9BQUUsR0FBRyw0Q0FBNEMsQ0FBQztJQUVsRTtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSxrQkFBa0IsQ0FBQyxFQUFFO1lBQ3pCLEtBQUss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