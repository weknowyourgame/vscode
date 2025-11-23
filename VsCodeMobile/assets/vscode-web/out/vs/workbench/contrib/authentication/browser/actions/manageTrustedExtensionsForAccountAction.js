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
import { fromNow } from '../../../../../base/common/date.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
import { IAuthenticationQueryService } from '../../../../services/authentication/common/authenticationQuery.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
export class ManageTrustedExtensionsForAccountAction extends Action2 {
    constructor() {
        super({
            id: '_manageTrustedExtensionsForAccount',
            title: localize2('manageTrustedExtensionsForAccount', "Manage Trusted Extensions For Account"),
            category: localize2('accounts', "Accounts"),
            f1: true
        });
    }
    run(accessor, options) {
        const instantiationService = accessor.get(IInstantiationService);
        return instantiationService.createInstance(ManageTrustedExtensionsForAccountActionImpl).run(options);
    }
}
let ManageTrustedExtensionsForAccountActionImpl = class ManageTrustedExtensionsForAccountActionImpl {
    constructor(_extensionService, _dialogService, _quickInputService, _authenticationService, _authenticationQueryService, _commandService, _extensionsWorkbenchService) {
        this._extensionService = _extensionService;
        this._dialogService = _dialogService;
        this._quickInputService = _quickInputService;
        this._authenticationService = _authenticationService;
        this._authenticationQueryService = _authenticationQueryService;
        this._commandService = _commandService;
        this._extensionsWorkbenchService = _extensionsWorkbenchService;
        this._viewDetailsButton = {
            tooltip: localize('viewExtensionDetails', "View extension details"),
            iconClass: ThemeIcon.asClassName(Codicon.info),
        };
        this._managePreferencesButton = {
            tooltip: localize('accountPreferences', "Manage account preferences for this extension"),
            iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
        };
    }
    async run(options) {
        const accountQuery = await this._resolveAccountQuery(options?.providerId, options?.accountLabel);
        if (!accountQuery) {
            return;
        }
        const items = await this._getItems(accountQuery);
        if (!items.length) {
            return;
        }
        const picker = this._createQuickPick(accountQuery);
        picker.items = items;
        picker.selectedItems = items.filter((i) => i.type !== 'separator' && !!i.picked);
        picker.show();
    }
    //#region Account Query Resolution
    async _resolveAccountQuery(providerId, accountLabel) {
        if (providerId && accountLabel) {
            return this._authenticationQueryService.provider(providerId).account(accountLabel);
        }
        const accounts = await this._getAllAvailableAccounts();
        const pick = await this._quickInputService.pick(accounts, {
            placeHolder: localize('pickAccount', "Pick an account to manage trusted extensions for"),
            matchOnDescription: true,
        });
        return pick ? this._authenticationQueryService.provider(pick.providerId).account(pick.label) : undefined;
    }
    async _getAllAvailableAccounts() {
        const accounts = [];
        for (const providerId of this._authenticationService.getProviderIds()) {
            const provider = this._authenticationService.getProvider(providerId);
            const sessions = await this._authenticationService.getSessions(providerId);
            const uniqueLabels = new Set();
            for (const session of sessions) {
                if (!uniqueLabels.has(session.account.label)) {
                    uniqueLabels.add(session.account.label);
                    accounts.push({
                        providerId,
                        label: session.account.label,
                        description: provider.label
                    });
                }
            }
        }
        return accounts;
    }
    //#endregion
    //#region Item Retrieval and Quick Pick Creation
    async _getItems(accountQuery) {
        const allowedExtensions = accountQuery.extensions().getAllowedExtensions();
        const extensionIdToDisplayName = new Map();
        // Get display names for all allowed extensions
        const resolvedExtensions = await Promise.all(allowedExtensions.map(ext => this._extensionService.getExtension(ext.id)));
        resolvedExtensions.forEach((resolved, i) => {
            if (resolved) {
                extensionIdToDisplayName.set(allowedExtensions[i].id, resolved.displayName || resolved.name);
            }
        });
        // Filter out extensions that are not currently installed and enrich with display names
        const filteredExtensions = allowedExtensions
            .filter(ext => extensionIdToDisplayName.has(ext.id))
            .map(ext => {
            const usage = accountQuery.extension(ext.id).getUsage();
            return {
                ...ext,
                // Use the extension display name from the extension service
                name: extensionIdToDisplayName.get(ext.id),
                lastUsed: usage.length > 0 ? Math.max(...usage.map(u => u.lastUsed)) : ext.lastUsed
            };
        });
        if (!filteredExtensions.length) {
            this._dialogService.info(localize('noTrustedExtensions', "This account has not been used by any extensions."));
            return [];
        }
        const trustedExtensions = filteredExtensions.filter(e => e.trusted);
        const otherExtensions = filteredExtensions.filter(e => !e.trusted);
        const sortByLastUsed = (a, b) => (b.lastUsed || 0) - (a.lastUsed || 0);
        const _toQuickPickItem = this._toQuickPickItem.bind(this);
        return [
            ...otherExtensions.sort(sortByLastUsed).map(_toQuickPickItem),
            { type: 'separator', label: localize('trustedExtensions', "Trusted by Microsoft") },
            ...trustedExtensions.sort(sortByLastUsed).map(_toQuickPickItem)
        ];
    }
    _toQuickPickItem(extension) {
        const lastUsed = extension.lastUsed;
        const description = lastUsed
            ? localize({ key: 'accountLastUsedDate', comment: ['The placeholder {0} is a string with time information, such as "3 days ago"'] }, "Last used this account {0}", fromNow(lastUsed, true))
            : localize('notUsed', "Has not used this account");
        let tooltip;
        let disabled;
        if (extension.trusted) {
            tooltip = localize('trustedExtensionTooltip', "This extension is trusted by Microsoft and\nalways has access to this account");
            disabled = true;
        }
        return {
            label: extension.name,
            extension,
            description,
            tooltip,
            disabled,
            buttons: [this._viewDetailsButton, this._managePreferencesButton],
            picked: extension.allowed === undefined || extension.allowed
        };
    }
    _createQuickPick(accountQuery) {
        const disposableStore = new DisposableStore();
        const quickPick = disposableStore.add(this._quickInputService.createQuickPick({ useSeparators: true }));
        // Configure quick pick
        quickPick.canSelectMany = true;
        quickPick.customButton = true;
        quickPick.customLabel = localize('manageTrustedExtensions.cancel', 'Cancel');
        quickPick.title = localize('manageTrustedExtensions', "Manage Trusted Extensions");
        quickPick.placeholder = localize('manageExtensions', "Choose which extensions can access this account");
        // Set up event handlers
        disposableStore.add(quickPick.onDidAccept(() => {
            const updatedAllowedList = quickPick.items
                .filter((item) => item.type !== 'separator')
                .map(i => i.extension);
            const allowedExtensionsSet = new Set(quickPick.selectedItems.map(i => i.extension));
            for (const extension of updatedAllowedList) {
                const allowed = allowedExtensionsSet.has(extension);
                accountQuery.extension(extension.id).setAccessAllowed(allowed, extension.name);
            }
            quickPick.hide();
        }));
        disposableStore.add(quickPick.onDidHide(() => disposableStore.dispose()));
        disposableStore.add(quickPick.onDidCustom(() => quickPick.hide()));
        disposableStore.add(quickPick.onDidTriggerItemButton(e => {
            if (e.button === this._managePreferencesButton) {
                this._commandService.executeCommand('_manageAccountPreferencesForExtension', e.item.extension.id, accountQuery.providerId);
            }
            else if (e.button === this._viewDetailsButton) {
                this._extensionsWorkbenchService.open(e.item.extension.id);
            }
        }));
        return quickPick;
    }
};
ManageTrustedExtensionsForAccountActionImpl = __decorate([
    __param(0, IExtensionService),
    __param(1, IDialogService),
    __param(2, IQuickInputService),
    __param(3, IAuthenticationService),
    __param(4, IAuthenticationQueryService),
    __param(5, ICommandService),
    __param(6, IExtensionsWorkbenchService)
], ManageTrustedExtensionsForAccountActionImpl);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlVHJ1c3RlZEV4dGVuc2lvbnNGb3JBY2NvdW50QWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYWN0aW9ucy9tYW5hZ2VUcnVzdGVkRXh0ZW5zaW9uc0ZvckFjY291bnRBY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbkYsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLCtEQUErRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxrQkFBa0IsRUFBdUMsTUFBTSx5REFBeUQsQ0FBQztBQUNsSSxPQUFPLEVBQW9CLHNCQUFzQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDeEgsT0FBTyxFQUFFLDJCQUEyQixFQUFpQixNQUFNLG1FQUFtRSxDQUFDO0FBQy9ILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRXZG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