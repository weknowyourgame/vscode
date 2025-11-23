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
import { Action2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
import { IAuthenticationQueryService } from '../../../../services/authentication/common/authenticationQuery.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
export class ManageAccountPreferencesForExtensionAction extends Action2 {
    constructor() {
        super({
            id: '_manageAccountPreferencesForExtension',
            title: localize2('manageAccountPreferenceForExtension', "Manage Extension Account Preferences..."),
            category: localize2('accounts', "Accounts"),
            f1: true,
            menu: [{
                    id: MenuId.AccountsContext,
                    order: 100,
                }],
        });
    }
    run(accessor, extensionId, providerId) {
        return accessor.get(IInstantiationService).createInstance(ManageAccountPreferenceForExtensionActionImpl).run(extensionId, providerId);
    }
}
let ManageAccountPreferenceForExtensionActionImpl = class ManageAccountPreferenceForExtensionActionImpl {
    constructor(_authenticationService, _quickInputService, _dialogService, _authenticationQueryService, _extensionService, _logService) {
        this._authenticationService = _authenticationService;
        this._quickInputService = _quickInputService;
        this._dialogService = _dialogService;
        this._authenticationQueryService = _authenticationQueryService;
        this._extensionService = _extensionService;
        this._logService = _logService;
    }
    async run(extensionId, providerId) {
        if (!extensionId) {
            const extensions = this._extensionService.extensions
                .filter(ext => this._authenticationQueryService.extension(ext.identifier.value).getAllAccountPreferences().size > 0)
                .sort((a, b) => (a.displayName ?? a.name).localeCompare((b.displayName ?? b.name)));
            const result = await this._quickInputService.pick(extensions.map(ext => ({
                label: ext.displayName ?? ext.name,
                id: ext.identifier.value
            })), {
                placeHolder: localize('selectExtension', "Select an extension to manage account preferences for"),
                title: localize('pickAProviderTitle', "Manage Extension Account Preferences")
            });
            extensionId = result?.id;
        }
        if (!extensionId) {
            return;
        }
        const extension = await this._extensionService.getExtension(extensionId);
        if (!extension) {
            throw new Error(`No extension with id ${extensionId}`);
        }
        if (!providerId) {
            // Use the query service's extension-centric approach to find providers that have been used
            const extensionQuery = this._authenticationQueryService.extension(extensionId);
            const providersWithAccess = await extensionQuery.getProvidersWithAccess();
            if (!providersWithAccess.length) {
                await this._dialogService.info(localize('noAccountUsage', "This extension has not used any accounts yet."));
                return;
            }
            providerId = providersWithAccess[0]; // Default to the first provider
            if (providersWithAccess.length > 1) {
                const result = await this._quickInputService.pick(providersWithAccess.map(providerId => ({
                    label: this._authenticationService.getProvider(providerId).label,
                    id: providerId,
                })), {
                    placeHolder: localize('selectProvider', "Select an authentication provider to manage account preferences for"),
                    title: localize('pickAProviderTitle', "Manage Extension Account Preferences")
                });
                if (!result) {
                    return; // User cancelled
                }
                providerId = result.id;
            }
        }
        // Only fetch accounts for the chosen provider
        const accounts = await this._authenticationService.getAccounts(providerId);
        const currentAccountNamePreference = this._authenticationQueryService.provider(providerId).extension(extensionId).getPreferredAccount();
        const items = this._getItems(accounts, providerId, currentAccountNamePreference);
        // If the provider supports multiple accounts, add an option to use a new account
        const provider = this._authenticationService.getProvider(providerId);
        if (provider.supportsMultipleAccounts) {
            // Get the last used scopes for the last used account. This will be used to pre-fill the scopes when adding a new account.
            // If there's no scopes, then don't add this option.
            const lastUsedScopes = accounts
                .flatMap(account => this._authenticationQueryService.provider(providerId).account(account.label).extension(extensionId).getUsage())
                .sort((a, b) => b.lastUsed - a.lastUsed)[0]?.scopes; // Sort by timestamp and take the most recent
            if (lastUsedScopes) {
                items.push({ type: 'separator' });
                items.push({
                    providerId,
                    scopes: lastUsedScopes,
                    label: localize('use new account', "Use a new account..."),
                });
            }
        }
        const disposables = new DisposableStore();
        const picker = this._createQuickPick(disposables, extensionId, extension.displayName ?? extension.name, provider.label);
        if (items.length === 0) {
            // We would only get here if we went through the Command Palette
            disposables.add(this._handleNoAccounts(picker));
            return;
        }
        picker.items = items;
        picker.show();
    }
    _createQuickPick(disposableStore, extensionId, extensionLabel, providerLabel) {
        const picker = disposableStore.add(this._quickInputService.createQuickPick({ useSeparators: true }));
        disposableStore.add(picker.onDidHide(() => {
            disposableStore.dispose();
        }));
        picker.placeholder = localize('placeholder v2', "Manage '{0}' account preferences for {1}...", extensionLabel, providerLabel);
        picker.title = localize('title', "'{0}' Account Preferences For This Workspace", extensionLabel);
        picker.sortByLabel = false;
        disposableStore.add(picker.onDidAccept(async () => {
            picker.hide();
            await this._accept(extensionId, picker.selectedItems);
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
        picker.validationMessage = localize('noAccounts', "No accounts are currently used by this extension.");
        picker.buttons = [this._quickInputService.backButton];
        picker.show();
        return Event.filter(picker.onDidTriggerButton, (e) => e === this._quickInputService.backButton)(() => this.run());
    }
    async _accept(extensionId, selectedItems) {
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
            const extensionQuery = this._authenticationQueryService.provider(providerId).extension(extensionId);
            const currentAccountName = extensionQuery.getPreferredAccount();
            if (currentAccountName === account.label) {
                // This account is already the preferred account
                continue;
            }
            extensionQuery.setPreferredAccount(account);
        }
    }
};
ManageAccountPreferenceForExtensionActionImpl = __decorate([
    __param(0, IAuthenticationService),
    __param(1, IQuickInputService),
    __param(2, IDialogService),
    __param(3, IAuthenticationQueryService),
    __param(4, IExtensionService),
    __param(5, ILogService)
], ManageAccountPreferenceForExtensionActionImpl);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlQWNjb3VudFByZWZlcmVuY2VzRm9yRXh0ZW5zaW9uQWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYWN0aW9ucy9tYW5hZ2VBY2NvdW50UHJlZmVyZW5jZXNGb3JFeHRlbnNpb25BY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxlQUFlLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN2RixPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDcEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxxQkFBcUIsRUFBb0IsTUFBTSwrREFBK0QsQ0FBQztBQUN4SCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDeEUsT0FBTyxFQUFFLGtCQUFrQixFQUE4QyxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pJLE9BQU8sRUFBZ0Msc0JBQXNCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUNwSSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUNoSCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUV6RixNQUFNLE9BQU8sMENBQTJDLFNBQVEsT0FBTztJQUN0RTtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSx1Q0FBdUM7WUFDM0MsS0FBSyxFQUFFLFNBQVMsQ0FBQyxxQ0FBcUMsRUFBRSx5Q0FBeUMs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