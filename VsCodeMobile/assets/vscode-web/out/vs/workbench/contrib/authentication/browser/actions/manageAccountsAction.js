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
import { Lazy } from '../../../../../base/common/lazy.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { ISecretStorageService } from '../../../../../platform/secrets/common/secrets.js';
import { getCurrentAuthenticationSessionInfo } from '../../../../services/authentication/browser/authenticationService.js';
import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
export class ManageAccountsAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.manageAccounts',
            title: localize2('manageAccounts', "Manage Accounts"),
            category: localize2('accounts', "Accounts"),
            f1: true
        });
    }
    run(accessor) {
        const instantiationService = accessor.get(IInstantiationService);
        return instantiationService.createInstance(ManageAccountsActionImpl).run();
    }
}
let ManageAccountsActionImpl = class ManageAccountsActionImpl {
    constructor(quickInputService, authenticationService, commandService, secretStorageService, productService) {
        this.quickInputService = quickInputService;
        this.authenticationService = authenticationService;
        this.commandService = commandService;
        this.secretStorageService = secretStorageService;
        this.productService = productService;
    }
    async run() {
        const placeHolder = localize('pickAccount', "Select an account to manage");
        const accounts = await this.listAccounts();
        if (!accounts.length) {
            await this.quickInputService.pick([{ label: localize('noActiveAccounts', "There are no active accounts.") }], { placeHolder });
            return;
        }
        const account = await this.quickInputService.pick(accounts, { placeHolder, matchOnDescription: true });
        if (!account) {
            return;
        }
        await this.showAccountActions(account);
    }
    async listAccounts() {
        const activeSession = new Lazy(() => getCurrentAuthenticationSessionInfo(this.secretStorageService, this.productService));
        const accounts = [];
        for (const providerId of this.authenticationService.getProviderIds()) {
            const provider = this.authenticationService.getProvider(providerId);
            for (const { label, id } of await this.authenticationService.getAccounts(providerId)) {
                accounts.push({
                    label,
                    description: provider.label,
                    providerId,
                    canUseMcp: !!provider.authorizationServers?.length,
                    canSignOut: async () => this.canSignOut(provider, id, await activeSession.value)
                });
            }
        }
        return accounts;
    }
    async canSignOut(provider, accountId, session) {
        if (session && !session.canSignOut && session.providerId === provider.id) {
            const sessions = await this.authenticationService.getSessions(provider.id);
            return !sessions.some(o => o.id === session.id && o.account.id === accountId);
        }
        return true;
    }
    async showAccountActions(account) {
        const { providerId, label: accountLabel, canUseMcp, canSignOut } = account;
        const store = new DisposableStore();
        const quickPick = store.add(this.quickInputService.createQuickPick());
        quickPick.title = localize('manageAccount', "Manage '{0}'", accountLabel);
        quickPick.placeholder = localize('selectAction', "Select an action");
        quickPick.buttons = [this.quickInputService.backButton];
        const items = [{
                label: localize('manageTrustedExtensions', "Manage Trusted Extensions"),
                action: () => this.commandService.executeCommand('_manageTrustedExtensionsForAccount', { providerId, accountLabel })
            }];
        if (canUseMcp) {
            items.push({
                label: localize('manageTrustedMCPServers', "Manage Trusted MCP Servers"),
                action: () => this.commandService.executeCommand('_manageTrustedMCPServersForAccount', { providerId, accountLabel })
            });
        }
        if (await canSignOut()) {
            items.push({
                label: localize('signOut', "Sign Out"),
                action: () => this.commandService.executeCommand('_signOutOfAccount', { providerId, accountLabel })
            });
        }
        quickPick.items = items;
        store.add(quickPick.onDidAccept(() => {
            const selected = quickPick.selectedItems[0];
            if (selected) {
                quickPick.hide();
                selected.action();
            }
        }));
        store.add(quickPick.onDidTriggerButton((button) => {
            if (button === this.quickInputService.backButton) {
                void this.run();
            }
        }));
        store.add(quickPick.onDidHide(() => store.dispose()));
        quickPick.show();
    }
};
ManageAccountsActionImpl = __decorate([
    __param(0, IQuickInputService),
    __param(1, IAuthenticationService),
    __param(2, ICommandService),
    __param(3, ISecretStorageService),
    __param(4, IProductService)
], ManageAccountsActionImpl);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlQWNjb3VudHNBY3Rpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvYXV0aGVudGljYXRpb24vYnJvd3Nlci9hY3Rpb25zL21hbmFnZUFjY291bnRzQWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDNUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxxQkFBcUIsRUFBb0IsTUFBTSwrREFBK0QsQ0FBQztBQUN4SCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLGtCQUFrQixFQUFrQixNQUFNLHlEQUF5RCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzFGLE9BQU8sRUFBNkIsbUNBQW1DLEVBQUUsTUFBTSxzRUFBc0UsQ0FBQztBQUN0SixPQUFPLEVBQTJCLHNCQUFzQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFFL0gsTUFBTSxPQUFPLG9CQUFxQixTQUFRLE9BQU87SUFDaEQ7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUsaUNBQWlDO1lBQ3JDLEtBQUssRUFBRSxTQUFTLENBQUMsZ0JBQWdCLEVBQUUsaUJBQWlCLENBQUM7WUFDckQsUUFBUSxFQUFFLFNBQVMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDO1lB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