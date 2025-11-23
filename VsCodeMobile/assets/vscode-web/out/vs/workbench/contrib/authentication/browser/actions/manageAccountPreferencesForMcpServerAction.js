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
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
import { IAuthenticationQueryService } from '../../../../services/authentication/common/authenticationQuery.js';
import { IMcpService } from '../../../mcp/common/mcpTypes.js';
export class ManageAccountPreferencesForMcpServerAction extends Action2 {
    constructor() {
        super({
            id: '_manageAccountPreferencesForMcpServer',
            title: localize2('manageAccountPreferenceForMcpServer', "Manage MCP Server Account Preferences"),
            category: localize2('accounts', "Accounts"),
            f1: false
        });
    }
    run(accessor, mcpServerId, providerId) {
        return accessor.get(IInstantiationService).createInstance(ManageAccountPreferenceForMcpServerActionImpl).run(mcpServerId, providerId);
    }
}
let ManageAccountPreferenceForMcpServerActionImpl = class ManageAccountPreferenceForMcpServerActionImpl {
    constructor(_authenticationService, _quickInputService, _dialogService, _authenticationQueryService, _mcpService, _logService) {
        this._authenticationService = _authenticationService;
        this._quickInputService = _quickInputService;
        this._dialogService = _dialogService;
        this._authenticationQueryService = _authenticationQueryService;
        this._mcpService = _mcpService;
        this._logService = _logService;
    }
    async run(mcpServerId, providerId) {
        if (!mcpServerId) {
            return;
        }
        const mcpServer = this._mcpService.servers.get().find(s => s.definition.id === mcpServerId);
        if (!mcpServer) {
            throw new Error(`No MCP server with id ${mcpServerId}`);
        }
        if (!providerId) {
            // Use the query service's MCP server-centric approach to find providers that have been used
            const mcpServerQuery = this._authenticationQueryService.mcpServer(mcpServerId);
            const providersWithAccess = await mcpServerQuery.getProvidersWithAccess();
            if (!providersWithAccess.length) {
                await this._dialogService.info(localize('noAccountUsage', "This MCP server has not used any accounts yet."));
                return;
            }
            providerId = providersWithAccess[0]; // Default to the first provider
            if (providersWithAccess.length > 1) {
                const result = await this._quickInputService.pick(providersWithAccess.map(providerId => ({
                    label: this._authenticationService.getProvider(providerId).label,
                    id: providerId,
                })), {
                    placeHolder: localize('selectProvider', "Select an authentication provider to manage account preferences for"),
                    title: localize('pickAProviderTitle', "Manage MCP Server Account Preferences")
                });
                if (!result) {
                    return; // User cancelled
                }
                providerId = result.id;
            }
        }
        // Only fetch accounts for the chosen provider
        const accounts = await this._authenticationService.getAccounts(providerId);
        const currentAccountNamePreference = this._authenticationQueryService.provider(providerId).mcpServer(mcpServerId).getPreferredAccount();
        const items = this._getItems(accounts, providerId, currentAccountNamePreference);
        // If the provider supports multiple accounts, add an option to use a new account
        const provider = this._authenticationService.getProvider(providerId);
        if (provider.supportsMultipleAccounts) {
            // Get the last used scopes for the last used account. This will be used to pre-fill the scopes when adding a new account.
            // If there's no scopes, then don't add this option.
            const lastUsedScopes = accounts
                .flatMap(account => this._authenticationQueryService.provider(providerId).account(account.label).mcpServer(mcpServerId).getUsage())
                .sort((a, b) => b.lastUsed - a.lastUsed)[0]?.scopes; // Sort by timestamp and take the most recent
            if (lastUsedScopes) {
                items.push({ type: 'separator' });
                items.push({
                    providerId: providerId,
                    scopes: lastUsedScopes,
                    label: localize('use new account', "Use a new account..."),
                });
            }
        }
        const disposables = new DisposableStore();
        const picker = this._createQuickPick(disposables, mcpServerId, mcpServer.definition.label, provider.label);
        if (items.length === 0) {
            // We would only get here if we went through the Command Palette
            disposables.add(this._handleNoAccounts(picker));
            return;
        }
        picker.items = items;
        picker.show();
    }
    _createQuickPick(disposableStore, mcpServerId, mcpServerLabel, providerLabel) {
        const picker = disposableStore.add(this._quickInputService.createQuickPick({ useSeparators: true }));
        disposableStore.add(picker.onDidHide(() => {
            disposableStore.dispose();
        }));
        picker.placeholder = localize('placeholder v2', "Manage '{0}' account preferences for {1}...", mcpServerLabel, providerLabel);
        picker.title = localize('title', "'{0}' Account Preferences For This Workspace", mcpServerLabel);
        picker.sortByLabel = false;
        disposableStore.add(picker.onDidAccept(async () => {
            picker.hide();
            await this._accept(mcpServerId, picker.selectedItems);
        }));
        return picker;
    }
    _getItems(accounts, providerId, currentAccountNamePreference) {
        return accounts.map(a => currentAccountNamePreference === a.label
            ? {
                label: a.label,
                account: a,
                providerId,
                description: localize('currentAccount', "Current account"),
                picked: true
            }
            : {
                label: a.label,
                account: a,
                providerId,
            });
    }
    _handleNoAccounts(picker) {
        picker.validationMessage = localize('noAccounts', "No accounts are currently used by this MCP server.");
        picker.buttons = [this._quickInputService.backButton];
        picker.show();
        return Event.filter(picker.onDidTriggerButton, (e) => e === this._quickInputService.backButton)(() => this.run());
    }
    async _accept(mcpServerId, selectedItems) {
        for (const item of selectedItems) {
            let account;
            if (!item.account) {
                try {
                    const session = await this._authenticationService.createSession(item.providerId, [...item.scopes]);
                    account = session.account;
                }
                catch (e) {
                    this._logService.error(e);
                    continue;
                }
            }
            else {
                account = item.account;
            }
            const providerId = item.providerId;
            const mcpQuery = this._authenticationQueryService.provider(providerId).mcpServer(mcpServerId);
            const currentAccountName = mcpQuery.getPreferredAccount();
            if (currentAccountName === account.label) {
                // This account is already the preferred account
                continue;
            }
            mcpQuery.setPreferredAccount(account);
        }
    }
};
ManageAccountPreferenceForMcpServerActionImpl = __decorate([
    __param(0, IAuthenticationService),
    __param(1, IQuickInputService),
    __param(2, IDialogService),
    __param(3, IAuthenticationQueryService),
    __param(4, IMcpService),
    __param(5, ILogService)
], ManageAccountPreferenceForMcpServerActionImpl);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlQWNjb3VudFByZWZlcmVuY2VzRm9yTWNwU2VydmVyQWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYWN0aW9ucy9tYW5hZ2VBY2NvdW50UHJlZmVyZW5jZXNGb3JNY3BTZXJ2ZXJBY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxlQUFlLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN2RixPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUM1RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbkYsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLCtEQUErRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsa0JBQWtCLEVBQThDLE1BQU0seURBQXlELENBQUM7QUFDekksT0FBTyxFQUFnQyxzQkFBc0IsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQ3BJLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLG1FQUFtRSxDQUFDO0FBQ2hILE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUU5RCxNQUFNLE9BQU8sMENBQTJDLFNBQVEsT0FBTztJQUN0RTtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSx1Q0FBdUM7WUFDM0MsS0FBSyxFQUFFLFNBQVMsQ0FBQyxxQ0FBcUMsRUFBRSx1Q0FBdUMsQ0FBQztZQUNoRyxR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