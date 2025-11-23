/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { ILanguageModelsService } from '../../common/languageModels.js';
import { IAuthenticationAccessService } from '../../../../services/authentication/browser/authenticationAccessService.js';
import { localize, localize2 } from '../../../../../nls.js';
import { INTERNAL_AUTH_PROVIDER_PREFIX } from '../../../../services/authentication/common/authentication.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { CHAT_CATEGORY } from './chatActions.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ManageModelsAction } from './manageModelsActions.js';
class ManageLanguageModelAuthenticationAction extends Action2 {
    static { this.ID = 'workbench.action.chat.manageLanguageModelAuthentication'; }
    constructor() {
        super({
            id: ManageLanguageModelAuthenticationAction.ID,
            title: localize2('manageLanguageModelAuthentication', 'Manage Language Model Access...'),
            category: CHAT_CATEGORY,
            precondition: ChatContextKeys.enabled,
            menu: [{
                    id: MenuId.AccountsContext,
                    order: 100,
                }],
            f1: true
        });
    }
    async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const languageModelsService = accessor.get(ILanguageModelsService);
        const authenticationAccessService = accessor.get(IAuthenticationAccessService);
        const dialogService = accessor.get(IDialogService);
        const extensionService = accessor.get(IExtensionService);
        const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const productService = accessor.get(IProductService);
        // Get all registered language models
        const modelIds = languageModelsService.getLanguageModelIds();
        // Group models by owning extension and collect all allowed extensions
        const extensionAuth = new Map();
        const ownerToAccountLabel = new Map();
        for (const modelId of modelIds) {
            const model = languageModelsService.lookupLanguageModel(modelId);
            if (!model?.auth) {
                continue; // Skip if model is not found
            }
            const ownerId = model.extension.value;
            if (extensionAuth.has(ownerId)) {
                // If the owner already exists, just continue
                continue;
            }
            // Get allowed extensions for this model's auth provider
            try {
                // Use providerLabel as the providerId and accountLabel (or default)
                const providerId = INTERNAL_AUTH_PROVIDER_PREFIX + ownerId;
                const accountLabel = model.auth.accountLabel || 'Language Models';
                ownerToAccountLabel.set(ownerId, accountLabel);
                const allowedExtensions = authenticationAccessService.readAllowedExtensions(providerId, accountLabel).filter(ext => !ext.trusted); // Filter out trusted extensions because those should not be modified
                if (productService.trustedExtensionAuthAccess && !Array.isArray(productService.trustedExtensionAuthAccess)) {
                    const trustedExtensions = productService.trustedExtensionAuthAccess[providerId];
                    // If the provider is trusted, add all trusted extensions to the allowed list
                    for (const ext of trustedExtensions) {
                        const index = allowedExtensions.findIndex(a => a.id === ext);
                        if (index !== -1) {
                            allowedExtensions.splice(index, 1);
                        }
                        const extension = await extensionService.getExtension(ext);
                        if (!extension) {
                            continue; // Skip if the extension is not found
                        }
                        allowedExtensions.push({
                            id: ext,
                            name: extension.displayName || extension.name,
                            allowed: true, // Assume trusted extensions are allowed by default
                            trusted: true // Mark as trusted
                        });
                    }
                }
                // Only grab extensions that are gettable from the extension service
                const filteredExtensions = new Array();
                for (const ext of allowedExtensions) {
                    if (await extensionService.getExtension(ext.id)) {
                        filteredExtensions.push(ext);
                    }
                }
                extensionAuth.set(ownerId, filteredExtensions);
                // Add all allowed extensions to the set for this owner
            }
            catch (error) {
                // Handle error by ensuring the owner is in the map
                if (!extensionAuth.has(ownerId)) {
                    extensionAuth.set(ownerId, []);
                }
            }
        }
        if (extensionAuth.size === 0) {
            dialogService.prompt({
                type: 'info',
                message: localize('noLanguageModels', 'No language models requiring authentication found.'),
                detail: localize('noLanguageModelsDetail', 'There are currently no language models that require authentication.')
            });
            return;
        }
        const items = [];
        // Create QuickPick items grouped by owner extension
        for (const [ownerId, allowedExtensions] of extensionAuth) {
            const extension = await extensionService.getExtension(ownerId);
            if (!extension) {
                // If the extension is not found, skip it
                continue;
            }
            // Add separator for the owning extension
            items.push({
                type: 'separator',
                id: ownerId,
                label: localize('extensionOwner', '{0}', extension.displayName || extension.name),
                buttons: [{
                        iconClass: ThemeIcon.asClassName(Codicon.info),
                        tooltip: localize('openExtension', 'Open Extension'),
                    }]
            });
            // Add allowed extensions as checkboxes (visual representation)
            let addedTrustedSeparator = false;
            if (allowedExtensions.length > 0) {
                for (const allowedExt of allowedExtensions) {
                    if (allowedExt.trusted && !addedTrustedSeparator) {
                        items.push({
                            type: 'separator',
                            label: localize('trustedExtension', 'Trusted by Microsoft'),
                        });
                        addedTrustedSeparator = true;
                    }
                    items.push({
                        label: allowedExt.name,
                        ownerId,
                        id: allowedExt.id,
                        picked: allowedExt.allowed ?? false,
                        extension: allowedExt,
                        disabled: allowedExt.trusted, // Don't allow toggling trusted extensions
                        buttons: [{
                                iconClass: ThemeIcon.asClassName(Codicon.info),
                                tooltip: localize('openExtension', 'Open Extension'),
                            }]
                    });
                }
            }
            else {
                items.push({
                    label: localize('noAllowedExtensions', 'No extensions have access'),
                    description: localize('noAccessDescription', 'No extensions are currently allowed to use models from {0}', ownerId),
                    pickable: false
                });
            }
        }
        // Show the QuickPick
        const result = await quickInputService.pick(items, {
            canPickMany: true,
            sortByLabel: true,
            onDidTriggerSeparatorButton(context) {
                // Handle separator button clicks
                const extId = context.separator.id;
                if (extId) {
                    // Open the extension in the editor
                    void extensionsWorkbenchService.open(extId);
                }
            },
            onDidTriggerItemButton(context) {
                // Handle item button clicks
                const extId = context.item.id;
                if (extId) {
                    // Open the extension in the editor
                    void extensionsWorkbenchService.open(extId);
                }
            },
            title: localize('languageModelAuthTitle', 'Manage Language Model Access'),
            placeHolder: localize('languageModelAuthPlaceholder', 'Choose which extensions can access language models'),
        });
        if (!result) {
            return;
        }
        for (const [ownerId, allowedExtensions] of extensionAuth) {
            // diff with result to find out which extensions are allowed or not
            // but we need to only look at the result items that have the ownerId
            const allowedSet = new Set(result
                .filter(item => item.ownerId === ownerId)
                // only save items that are not trusted automatically
                .filter(item => !item.extension?.trusted)
                .map(item => item.id));
            for (const allowedExt of allowedExtensions) {
                allowedExt.allowed = allowedSet.has(allowedExt.id);
            }
            authenticationAccessService.updateAllowedExtensions(INTERNAL_AUTH_PROVIDER_PREFIX + ownerId, ownerToAccountLabel.get(ownerId) || 'Language Models', allowedExtensions);
        }
    }
}
export function registerLanguageModelActions() {
    registerAction2(ManageLanguageModelAuthenticationAction);
    registerAction2(ManageModelsAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdExhbmd1YWdlTW9kZWxBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRMYW5ndWFnZU1vZGVsQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUVyRyxPQUFPLEVBQUUsa0JBQWtCLEVBQWtDLE1BQU0seURBQXlELENBQUM7QUFDN0gsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sNEVBQTRFLENBQUM7QUFDMUgsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQW9CLDZCQUE2QixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDL0gsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN6RixPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN2RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFFOUQsTUFBTSx1Q0FBd0MsU0FBUSxPQUFPO2FBQzVDLE9BQUUsR0FBRyx5REFBeUQsQ0FBQztJQUUvRTtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSx1Q0FBdUMsQ0FBQyxFQUFFO1lBQzlDLEtBQUssRUFBRSxTQUFTLENBQUMsbUNBQW1DLEVBQUUsaUNBQWlDLENBQUM7WUFDeEYsUUFBUSxFQUFFLGFBQWE7WUFDdkIsWUFBWSxFQUFFLGVBQWUsQ0FBQyxPQUFPO1lBQ3JDLElBQUksRUFBRSxDQUFDO29CQUNOLEVBQUUsRUFBRSxNQUFNLENBQUMsZUFBZTtvQkFDMUIsS0FBSyxFQUFFLEdBQUc7aUJBQ1YsQ0FBQztZQUNGLEVBQUUsRUFBRSxJQUFJO1NBQ1IsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEI7UUFDbkMsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDM0QsTUFBTSxxQkFBcUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDbkUsTUFBTSwyQkFBMkIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDL0UsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNuRCxNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUN6RCxNQUFNLDBCQUEwQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsMkJBQTJCLENBQUMsQ0FBQztRQUM3RSxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRXJELHFDQUFxQztRQUNyQyxNQUFNLFFBQVEsR0FBRyxxQkFBcUIsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBRTdELHNFQUFzRTtRQUN0RSxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsRUFBOEIsQ0FBQztRQUU1RCxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBQ3RELEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFLENBQUM7WUFDaEMsTUFBTSxLQUFLLEdBQUcscUJBQXFCLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDakUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQztnQkFDbEIsU0FBUyxDQUFDLDZCQUE2QjtZQUN4QyxDQUFDO1lBQ0QsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7WUFDdEMsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ2hDLDZDQUE2QztnQkFDN0MsU0FBUztZQUNWLENBQUM7WUFFRCx3REFBd0Q7WUFDeEQsSUFBSSxDQUFDO2dCQUNKLG9FQUFvRTtnQkFDcEUsTUFBTSxVQUFVLEdBQUcsNkJBQTZCLEdBQUcsT0FBTyxDQUFDO2dCQUMzRCxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxpQkFBaUIsQ0FBQztnQkFDbEUsbUJBQW1CLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztnQkFDL0MsTUFBTSxpQkFBaUIsR0FBRywyQkFBMkIsQ0FBQyxxQkFBcUIsQ0FDMUUsVUFBVSxFQUNWLFlBQVksQ0FDWixDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMscUVBQXFFO2dCQUVwRyxJQUFJLGNBQWMsQ0FBQywwQkFBMEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLDBCQUEwQixDQUFDLEVBQUUsQ0FBQztvQkFDNUcsTUFBTSxpQkFBaUIsR0FBRyxjQUFjLENBQUMsMEJBQTBCLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBQ2hGLDZFQUE2RTtvQkFDN0UsS0FBSyxNQUFNLEdBQUcsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO3dCQUNyQyxNQUFNLEtBQUssR0FBRyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDO3dCQUM3RCxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDOzRCQUNsQixpQkFBaUIsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNwQyxDQUFDO3dCQUNELE1BQU0sU0FBUyxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUMzRCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7NEJBQ2hCLFNBQVMsQ0FBQyxxQ0FBcUM7d0JBQ2hELENBQUM7d0JBQ0QsaUJBQWlCLENBQUMsSUFBSSxDQUFDOzRCQUN0QixFQUFFLEVBQUUsR0FBRzs0QkFDUCxJQUFJLEVBQUUsU0FBUyxDQUFDLFdBQVcsSUFBSSxTQUFTLENBQUMsSUFBSTs0QkFDN0MsT0FBTyxFQUFFLElBQUksRUFBRSxtREFBbUQ7NEJBQ2xFLE9BQU8sRUFBRSxJQUFJLENBQUMsa0JBQWtCO3lCQUNoQyxDQUFDLENBQUM7b0JBQ0osQ0FBQztnQkFDRixDQUFDO2dCQUVELG9FQUFvRTtnQkFDcEUsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLEtBQUssRUFBb0IsQ0FBQztnQkFDekQsS0FBSyxNQUFNLEdBQUcsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO29CQUNyQyxJQUFJLE1BQU0sZ0JBQWdCLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO3dCQUNqRCxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzlCLENBQUM7Z0JBQ0YsQ0FBQztnQkFFRCxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO2dCQUMvQyx1REFBdUQ7WUFDeEQsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2hCLG1EQUFtRDtnQkFDbkQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztvQkFDakMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ2hDLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksYUFBYSxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM5QixhQUFhLENBQUMsTUFBTSxDQUFDO2dCQUNwQixJQUFJLEVBQUUsTUFBTTtnQkFDWixPQUFPLEVBQUUsUUFBUSxDQUFDLGtCQUFrQixFQUFFLG9EQUFvRCxDQUFDO2dCQUMzRixNQUFNLEVBQUUsUUFBUSxDQUFDLHdCQUF3QixFQUFFLHFFQUFxRSxDQUFDO2FBQ2pILENBQUMsQ0FBQztZQUNILE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQTBGLEVBQUUsQ0FBQztRQUN4RyxvREFBb0Q7UUFDcEQsS0FBSyxNQUFNLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLElBQUksYUFBYSxFQUFFLENBQUM7WUFDMUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDL0QsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNoQix5Q0FBeUM7Z0JBQ3pDLFNBQVM7WUFDVixDQUFDO1lBQ0QseUNBQXlDO1lBQ3pDLEtBQUssQ0FBQyxJQUFJLENBQUM7Z0JBQ1YsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLEVBQUUsRUFBRSxPQUFPO2dCQUNYLEtBQUssRUFBRSxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQyxXQUFXLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQztnQkFDakYsT0FBTyxFQUFFLENBQUM7d0JBQ1QsU0FBUyxFQUFFLFNBQVMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQzt3QkFDOUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxlQUFlLEVBQUUsZ0JBQWdCLENBQUM7cUJBQ3BELENBQUM7YUFDRixDQUFDLENBQUM7WUFFSCwrREFBK0Q7WUFDL0QsSUFBSSxxQkFBcUIsR0FBRyxLQUFLLENBQUM7WUFDbEMsSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLEtBQUssTUFBTSxVQUFVLElBQUksaUJBQWlCLEVBQUUsQ0FBQztvQkFDNUMsSUFBSSxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQzt3QkFDbEQsS0FBSyxDQUFDLElBQUksQ0FBQzs0QkFDVixJQUFJLEVBQUUsV0FBVzs0QkFDakIsS0FBSyxFQUFFLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxzQkFBc0IsQ0FBQzt5QkFDM0QsQ0FBQyxDQUFDO3dCQUNILHFCQUFxQixHQUFHLElBQUksQ0FBQztvQkFDOUIsQ0FBQztvQkFDRCxLQUFLLENBQUMsSUFBSSxDQUFDO3dCQUNWLEtBQUssRUFBRSxVQUFVLENBQUMsSUFBSTt3QkFDdEIsT0FBTzt3QkFDUCxFQUFFLEVBQUUsVUFBVSxDQUFDLEVBQUU7d0JBQ2pCLE1BQU0sRUFBRSxVQUFVLENBQUMsT0FBTyxJQUFJLEtBQUs7d0JBQ25DLFNBQVMsRUFBRSxVQUFVO3dCQUNyQixRQUFRLEVBQUUsVUFBVSxDQUFDLE9BQU8sRUFBRSwwQ0FBMEM7d0JBQ3hFLE9BQU8sRUFBRSxDQUFDO2dDQUNULFNBQVMsRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7Z0NBQzlDLE9BQU8sRUFBRSxRQUFRLENBQUMsZUFBZSxFQUFFLGdCQUFnQixDQUFDOzZCQUNwRCxDQUFDO3FCQUNGLENBQUMsQ0FBQztnQkFDSixDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLEtBQUssQ0FBQyxJQUFJLENBQUM7b0JBQ1YsS0FBSyxFQUFFLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSwyQkFBMkIsQ0FBQztvQkFDbkUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSw0REFBNEQsRUFBRSxPQUFPLENBQUM7b0JBQ25ILFFBQVEsRUFBRSxLQUFLO2lCQUNmLENBQUMsQ0FBQztZQUNKLENBQUM7UUFDRixDQUFDO1FBRUQscUJBQXFCO1FBQ3JCLE1BQU0sTUFBTSxHQUFHLE1BQU0saUJBQWlCLENBQUMsSUFBSSxDQUMxQyxLQUFLLEVBQ0w7WUFDQyxXQUFXLEVBQUUsSUFBSTtZQUNqQixXQUFXLEVBQUUsSUFBSTtZQUNqQiwyQkFBMkIsQ0FBQyxPQUFPO2dCQUNsQyxpQ0FBaUM7Z0JBQ2pDLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO2dCQUNuQyxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNYLG1DQUFtQztvQkFDbkMsS0FBSywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzdDLENBQUM7WUFDRixDQUFDO1lBQ0Qsc0JBQXNCLENBQUMsT0FBTztnQkFDN0IsNEJBQTRCO2dCQUM1QixNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDOUIsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDWCxtQ0FBbUM7b0JBQ25DLEtBQUssMEJBQTBCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM3QyxDQUFDO1lBQ0YsQ0FBQztZQUNELEtBQUssRUFBRSxRQUFRLENBQUMsd0JBQXdCLEVBQUUsOEJBQThCLENBQUM7WUFDekUsV0FBVyxFQUFFLFFBQVEsQ0FBQyw4QkFBOEIsRUFBRSxvREFBb0QsQ0FBQztTQUMzRyxDQUNELENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDYixPQUFPO1FBQ1IsQ0FBQztRQUVELEtBQUssTUFBTSxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQzFELG1FQUFtRTtZQUNuRSxxRUFBcUU7WUFDckUsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTTtpQkFDL0IsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sS0FBSyxPQUFPLENBQUM7Z0JBQ3pDLHFEQUFxRDtpQkFDcEQsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQztpQkFDeEMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUcsQ0FBQyxDQUFDLENBQUM7WUFFekIsS0FBSyxNQUFNLFVBQVUsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO2dCQUM1QyxVQUFVLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3BELENBQUM7WUFFRCwyQkFBMkIsQ0FBQyx1QkFBdUIsQ0FDbEQsNkJBQTZCLEdBQUcsT0FBTyxFQUN2QyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksaUJBQWlCLEVBQ3JELGlCQUFpQixDQUNqQixDQUFDO1FBQ0gsQ0FBQztJQUVGLENBQUM7O0FBR0YsTUFBTSxVQUFVLDRCQUE0QjtJQUMzQyxlQUFlLENBQUMsdUNBQXVDLENBQUMsQ0FBQztJQUN6RCxlQUFlLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUNyQyxDQUFDIn0=