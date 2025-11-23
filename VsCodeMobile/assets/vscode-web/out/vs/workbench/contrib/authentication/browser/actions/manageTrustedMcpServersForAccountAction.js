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
import { ChatContextKeys } from '../../../chat/common/chatContextKeys.js';
import { IMcpService } from '../../../mcp/common/mcpTypes.js';
export class ManageTrustedMcpServersForAccountAction extends Action2 {
    constructor() {
        super({
            id: '_manageTrustedMCPServersForAccount',
            title: localize2('manageTrustedMcpServersForAccount', "Manage Trusted MCP Servers For Account"),
            category: localize2('accounts', "Accounts"),
            f1: true,
            precondition: ChatContextKeys.Setup.hidden.negate()
        });
    }
    run(accessor, options) {
        const instantiationService = accessor.get(IInstantiationService);
        return instantiationService.createInstance(ManageTrustedMcpServersForAccountActionImpl).run(options);
    }
}
let ManageTrustedMcpServersForAccountActionImpl = class ManageTrustedMcpServersForAccountActionImpl {
    constructor(_mcpServerService, _dialogService, _quickInputService, _mcpServerAuthenticationService, _authenticationQueryService, _commandService) {
        this._mcpServerService = _mcpServerService;
        this._dialogService = _dialogService;
        this._quickInputService = _quickInputService;
        this._mcpServerAuthenticationService = _mcpServerAuthenticationService;
        this._authenticationQueryService = _authenticationQueryService;
        this._commandService = _commandService;
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
            placeHolder: localize('pickAccount', "Pick an account to manage trusted MCP servers for"),
            matchOnDescription: true,
        });
        return pick ? this._authenticationQueryService.provider(pick.providerId).account(pick.label) : undefined;
    }
    async _getAllAvailableAccounts() {
        const accounts = [];
        for (const providerId of this._mcpServerAuthenticationService.getProviderIds()) {
            const provider = this._mcpServerAuthenticationService.getProvider(providerId);
            const sessions = await this._mcpServerAuthenticationService.getSessions(providerId);
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
        const allowedMcpServers = accountQuery.mcpServers().getAllowedMcpServers();
        const serverIdToLabel = new Map(this._mcpServerService.servers.get().map(s => [s.definition.id, s.definition.label]));
        const filteredMcpServers = allowedMcpServers
            // Filter out MCP servers that are not in the current list of servers
            .filter(server => serverIdToLabel.has(server.id))
            .map(server => {
            const usage = accountQuery.mcpServer(server.id).getUsage();
            return {
                ...server,
                // Use the server name from the MCP service
                name: serverIdToLabel.get(server.id),
                lastUsed: usage.length > 0 ? Math.max(...usage.map(u => u.lastUsed)) : server.lastUsed
            };
        });
        if (!filteredMcpServers.length) {
            this._dialogService.info(localize('noTrustedMcpServers', "This account has not been used by any MCP servers."));
            return [];
        }
        const trustedServers = filteredMcpServers.filter(s => s.trusted);
        const otherServers = filteredMcpServers.filter(s => !s.trusted);
        const sortByLastUsed = (a, b) => (b.lastUsed || 0) - (a.lastUsed || 0);
        return [
            ...otherServers.sort(sortByLastUsed).map(this._toQuickPickItem),
            { type: 'separator', label: localize('trustedMcpServers', "Trusted by Microsoft") },
            ...trustedServers.sort(sortByLastUsed).map(this._toQuickPickItem)
        ];
    }
    _toQuickPickItem(mcpServer) {
        const lastUsed = mcpServer.lastUsed;
        const description = lastUsed
            ? localize({ key: 'accountLastUsedDate', comment: ['The placeholder {0} is a string with time information, such as "3 days ago"'] }, "Last used this account {0}", fromNow(lastUsed, true))
            : localize('notUsed', "Has not used this account");
        let tooltip;
        let disabled;
        if (mcpServer.trusted) {
            tooltip = localize('trustedMcpServerTooltip', "This MCP server is trusted by Microsoft and\nalways has access to this account");
            disabled = true;
        }
        return {
            label: mcpServer.name,
            mcpServer,
            description,
            tooltip,
            disabled,
            buttons: [{
                    tooltip: localize('accountPreferences', "Manage account preferences for this MCP server"),
                    iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
                }],
            picked: mcpServer.allowed === undefined || mcpServer.allowed
        };
    }
    _createQuickPick(accountQuery) {
        const disposableStore = new DisposableStore();
        const quickPick = disposableStore.add(this._quickInputService.createQuickPick({ useSeparators: true }));
        // Configure quick pick
        quickPick.canSelectMany = true;
        quickPick.customButton = true;
        quickPick.customLabel = localize('manageTrustedMcpServers.cancel', 'Cancel');
        quickPick.title = localize('manageTrustedMcpServers', "Manage Trusted MCP Servers");
        quickPick.placeholder = localize('manageMcpServers', "Choose which MCP servers can access this account");
        // Set up event handlers
        disposableStore.add(quickPick.onDidAccept(() => {
            quickPick.hide();
            const allServers = quickPick.items
                .filter((item) => item.type !== 'separator')
                .map((i) => i.mcpServer);
            const selectedServers = new Set(quickPick.selectedItems.map((i) => i.mcpServer));
            for (const mcpServer of allServers) {
                const isAllowed = selectedServers.has(mcpServer);
                accountQuery.mcpServer(mcpServer.id).setAccessAllowed(isAllowed, mcpServer.name);
            }
        }));
        disposableStore.add(quickPick.onDidHide(() => disposableStore.dispose()));
        disposableStore.add(quickPick.onDidCustom(() => quickPick.hide()));
        disposableStore.add(quickPick.onDidTriggerItemButton((e) => this._commandService.executeCommand('_manageAccountPreferencesForMcpServer', e.item.mcpServer.id, accountQuery.providerId)));
        return quickPick;
    }
};
ManageTrustedMcpServersForAccountActionImpl = __decorate([
    __param(0, IMcpService),
    __param(1, IDialogService),
    __param(2, IQuickInputService),
    __param(3, IAuthenticationService),
    __param(4, IAuthenticationQueryService),
    __param(5, ICommandService)
], ManageTrustedMcpServersForAccountActionImpl);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlVHJ1c3RlZE1jcFNlcnZlcnNGb3JBY2NvdW50QWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYWN0aW9ucy9tYW5hZ2VUcnVzdGVkTWNwU2VydmVyc0ZvckFjY291bnRBY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbkYsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLCtEQUErRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxrQkFBa0IsRUFBdUMsTUFBTSx5REFBeUQsQ0FBQztBQUVsSSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsMkJBQTJCLEVBQWlCLE1BQU0sbUVBQW1FLENBQUM7QUFDL0gsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUU5RCxNQUFN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