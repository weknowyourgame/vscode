/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize, localize2 } from '../../../../../nls.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IDynamicAuthenticationProviderStorageService } from '../../../../services/authentication/common/dynamicAuthenticationProviderStorage.js';
import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
export class RemoveDynamicAuthenticationProvidersAction extends Action2 {
    static { this.ID = 'workbench.action.removeDynamicAuthenticationProviders'; }
    constructor() {
        super({
            id: RemoveDynamicAuthenticationProvidersAction.ID,
            title: localize2('removeDynamicAuthProviders', 'Remove Dynamic Authentication Providers'),
            category: localize2('authenticationCategory', 'Authentication'),
            f1: true
        });
    }
    async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const dynamicAuthStorageService = accessor.get(IDynamicAuthenticationProviderStorageService);
        const authenticationService = accessor.get(IAuthenticationService);
        const dialogService = accessor.get(IDialogService);
        const interactedProviders = dynamicAuthStorageService.getInteractedProviders();
        if (interactedProviders.length === 0) {
            await dialogService.info(localize('noDynamicProviders', 'No dynamic authentication providers'), localize('noDynamicProvidersDetail', 'No dynamic authentication providers have been used yet.'));
            return;
        }
        const items = interactedProviders.map(provider => ({
            label: provider.label,
            description: localize('clientId', 'Client ID: {0}', provider.clientId),
            provider
        }));
        const selected = await quickInputService.pick(items, {
            placeHolder: localize('selectProviderToRemove', 'Select a dynamic authentication provider to remove'),
            canPickMany: true
        });
        if (!selected || selected.length === 0) {
            return;
        }
        // Confirm deletion
        const providerNames = selected.map(item => item.provider.label).join(', ');
        const message = selected.length === 1
            ? localize('confirmDeleteSingleProvider', 'Are you sure you want to remove the dynamic authentication provider "{0}"?', providerNames)
            : localize('confirmDeleteMultipleProviders', 'Are you sure you want to remove {0} dynamic authentication providers: {1}?', selected.length, providerNames);
        const result = await dialogService.confirm({
            message,
            detail: localize('confirmDeleteDetail', 'This will remove all stored authentication data for the selected provider(s). You will need to re-authenticate if you use these providers again.'),
            primaryButton: localize('remove', 'Remove'),
            type: 'warning'
        });
        if (!result.confirmed) {
            return;
        }
        // Remove the selected providers
        for (const item of selected) {
            const providerId = item.provider.providerId;
            // Unregister from authentication service if still registered
            if (authenticationService.isAuthenticationProviderRegistered(providerId)) {
                authenticationService.unregisterAuthenticationProvider(providerId);
            }
            // Remove from dynamic storage service
            await dynamicAuthStorageService.removeDynamicProvider(providerId);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlRHluYW1pY0F1dGhlbnRpY2F0aW9uUHJvdmlkZXJzQWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYWN0aW9ucy9tYW5hZ2VEeW5hbWljQXV0aGVudGljYXRpb25Qcm92aWRlcnNBY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFNUUsT0FBTyxFQUFFLGtCQUFrQixFQUFrQixNQUFNLHlEQUF5RCxDQUFDO0FBQzdHLE9BQU8sRUFBRSw0Q0FBNEMsRUFBcUMsTUFBTSxvRkFBb0YsQ0FBQztBQUNyTCxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFNbkYsTUFBTSxPQUFPLDBDQUEyQyxTQUFRLE9BQU87YUFFdEQsT0FBRSxHQUFHLHVEQUF1RCxDQUFDO0lBRTdFO1FBQ0MsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLDBDQUEwQyxDQUFDLEVBQUU7WUFDakQsS0FBSyxFQUFFLFNBQVMsQ0FBQyw0QkFBNEIsRUFBRSx5Q0FBeUMsQ0FBQztZQUN6RixRQUFRLEVBQUUsU0FBUyxDQUFDLHdCQUF3QixFQUFFLGdCQUFnQixDQUFDO1lBQy9ELEVBQUUsRUFBRSxJQUFJO1NBQ1IsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEI7UUFDbkMsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDM0QsTUFB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