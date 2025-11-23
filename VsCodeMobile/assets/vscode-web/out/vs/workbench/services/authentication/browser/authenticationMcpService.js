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
import { Disposable, DisposableStore, dispose, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { scopesMatch } from '../../../../base/common/oauth.js';
import * as nls from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Severity } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IActivityService, NumberBadge } from '../../activity/common/activity.js';
import { IAuthenticationMcpAccessService } from './authenticationMcpAccessService.js';
import { IAuthenticationMcpUsageService } from './authenticationMcpUsageService.js';
import { IAuthenticationService } from '../common/authentication.js';
import { Emitter } from '../../../../base/common/event.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
// OAuth2 spec prohibits space in a scope, so use that to join them.
const SCOPESLIST_SEPARATOR = ' ';
// TODO: Move this into MainThreadAuthentication
export const IAuthenticationMcpService = createDecorator('IAuthenticationMcpService');
// TODO@TylerLeonhardt: This should all go in MainThreadAuthentication
let AuthenticationMcpService = class AuthenticationMcpService extends Disposable {
    constructor(activityService, storageService, dialogService, quickInputService, _productService, _authenticationService, _authenticationUsageService, _authenticationAccessService) {
        super();
        this.activityService = activityService;
        this.storageService = storageService;
        this.dialogService = dialogService;
        this.quickInputService = quickInputService;
        this._productService = _productService;
        this._authenticationService = _authenticationService;
        this._authenticationUsageService = _authenticationUsageService;
        this._authenticationAccessService = _authenticationAccessService;
        this._signInRequestItems = new Map();
        this._sessionAccessRequestItems = new Map();
        this._accountBadgeDisposable = this._register(new MutableDisposable());
        this._onDidAccountPreferenceChange = this._register(new Emitter());
        this.onDidChangeAccountPreference = this._onDidAccountPreferenceChange.event;
        this._inheritAuthAccountPreferenceParentToChildren = this._productService.inheritAuthAccountPreference || {};
        this._inheritAuthAccountPreferenceChildToParent = Object.entries(this._inheritAuthAccountPreferenceParentToChildren).reduce((acc, [parent, children]) => {
            children.forEach((child) => {
                acc[child] = parent;
            });
            return acc;
        }, {});
        this.registerListeners();
    }
    registerListeners() {
        this._register(this._authenticationService.onDidChangeSessions(async (e) => {
            if (e.event.added?.length) {
                await this.updateNewSessionRequests(e.providerId, e.event.added);
            }
            if (e.event.removed?.length) {
                await this.updateAccessRequests(e.providerId, e.event.removed);
            }
            this.updateBadgeCount();
        }));
        this._register(this._authenticationService.onDidUnregisterAuthenticationProvider(e => {
            const accessRequests = this._sessionAccessRequestItems.get(e.id) || {};
            Object.keys(accessRequests).forEach(mcpServerId => {
                this.removeAccessRequest(e.id, mcpServerId);
            });
        }));
    }
    async updateNewSessionRequests(providerId, addedSessions) {
        const existingRequestsForProvider = this._signInRequestItems.get(providerId);
        if (!existingRequestsForProvider) {
            return;
        }
        Object.keys(existingRequestsForProvider).forEach(requestedScopes => {
            // Parse the requested scopes from the stored key
            const requestedScopesArray = requestedScopes.split(SCOPESLIST_SEPARATOR);
            // Check if any added session has matching scopes (order-independent)
            if (addedSessions.some(session => scopesMatch(session.scopes, requestedScopesArray))) {
                const sessionRequest = existingRequestsForProvider[requestedScopes];
                sessionRequest?.disposables.forEach(item => item.dispose());
                delete existingRequestsForProvider[requestedScopes];
                if (Object.keys(existingRequestsForProvider).length === 0) {
                    this._signInRequestItems.delete(providerId);
                }
                else {
                    this._signInRequestItems.set(providerId, existingRequestsForProvider);
                }
            }
        });
    }
    async updateAccessRequests(providerId, removedSessions) {
        const providerRequests = this._sessionAccessRequestItems.get(providerId);
        if (providerRequests) {
            Object.keys(providerRequests).forEach(mcpServerId => {
                removedSessions.forEach(removed => {
                    const indexOfSession = providerRequests[mcpServerId].possibleSessions.findIndex(session => session.id === removed.id);
                    if (indexOfSession) {
                        providerRequests[mcpServerId].possibleSessions.splice(indexOfSession, 1);
                    }
                });
                if (!providerRequests[mcpServerId].possibleSessions.length) {
                    this.removeAccessRequest(providerId, mcpServerId);
                }
            });
        }
    }
    updateBadgeCount() {
        this._accountBadgeDisposable.clear();
        let numberOfRequests = 0;
        this._signInRequestItems.forEach(providerRequests => {
            Object.keys(providerRequests).forEach(request => {
                numberOfRequests += providerRequests[request].requestingMcpServerIds.length;
            });
        });
        this._sessionAccessRequestItems.forEach(accessRequest => {
            numberOfRequests += Object.keys(accessRequest).length;
        });
        if (numberOfRequests > 0) {
            const badge = new NumberBadge(numberOfRequests, () => nls.localize('sign in', "Sign in requested"));
            this._accountBadgeDisposable.value = this.activityService.showAccountsActivity({ badge });
        }
    }
    removeAccessRequest(providerId, mcpServerId) {
        const providerRequests = this._sessionAccessRequestItems.get(providerId) || {};
        if (providerRequests[mcpServerId]) {
            dispose(providerRequests[mcpServerId].disposables);
            delete providerRequests[mcpServerId];
            this.updateBadgeCount();
        }
    }
    //#region Account/Session Preference
    updateAccountPreference(mcpServerId, providerId, account) {
        const parentMcpServerId = this._inheritAuthAccountPreferenceChildToParent[mcpServerId] ?? mcpServerId;
        const key = this._getKey(parentMcpServerId, providerId);
        // Store the preference in the workspace and application storage. This allows new workspaces to
        // have a preference set already to limit the number of prompts that are shown... but also allows
        // a specific workspace to override the global preference.
        this.storageService.store(key, account.label, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        this.storageService.store(key, account.label, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        const childrenMcpServers = this._inheritAuthAccountPreferenceParentToChildren[parentMcpServerId];
        const mcpServerIds = childrenMcpServers ? [parentMcpServerId, ...childrenMcpServers] : [parentMcpServerId];
        this._onDidAccountPreferenceChange.fire({ mcpServerIds, providerId });
    }
    getAccountPreference(mcpServerId, providerId) {
        const key = this._getKey(this._inheritAuthAccountPreferenceChildToParent[mcpServerId] ?? mcpServerId, providerId);
        // If a preference is set in the workspace, use that. Otherwise, use the global preference.
        return this.storageService.get(key, 1 /* StorageScope.WORKSPACE */) ?? this.storageService.get(key, -1 /* StorageScope.APPLICATION */);
    }
    removeAccountPreference(mcpServerId, providerId) {
        const key = this._getKey(this._inheritAuthAccountPreferenceChildToParent[mcpServerId] ?? mcpServerId, providerId);
        // This won't affect any other workspaces that have a preference set, but it will remove the preference
        // for this workspace and the global preference. This is only paired with a call to updateSessionPreference...
        // so we really don't _need_ to remove them as they are about to be overridden anyway... but it's more correct
        // to remove them first... and in case this gets called from somewhere else in the future.
        this.storageService.remove(key, 1 /* StorageScope.WORKSPACE */);
        this.storageService.remove(key, -1 /* StorageScope.APPLICATION */);
    }
    _getKey(mcpServerId, providerId) {
        return `${mcpServerId}-${providerId}`;
    }
    // TODO@TylerLeonhardt: Remove all of this after a couple iterations
    updateSessionPreference(providerId, mcpServerId, session) {
        // The 3 parts of this key are important:
        // * MCP server id: The MCP server that has a preference
        // * Provider id: The provider that the preference is for
        // * The scopes: The subset of sessions that the preference applies to
        const key = `${mcpServerId}-${providerId}-${session.scopes.join(SCOPESLIST_SEPARATOR)}`;
        // Store the preference in the workspace and application storage. This allows new workspaces to
        // have a preference set already to limit the number of prompts that are shown... but also allows
        // a specific workspace to override the global preference.
        this.storageService.store(key, session.id, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        this.storageService.store(key, session.id, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
    }
    getSessionPreference(providerId, mcpServerId, scopes) {
        // The 3 parts of this key are important:
        // * MCP server id: The MCP server that has a preference
        // * Provider id: The provider that the preference is for
        // * The scopes: The subset of sessions that the preference applies to
        const key = `${mcpServerId}-${providerId}-${scopes.join(SCOPESLIST_SEPARATOR)}`;
        // If a preference is set in the workspace, use that. Otherwise, use the global preference.
        return this.storageService.get(key, 1 /* StorageScope.WORKSPACE */) ?? this.storageService.get(key, -1 /* StorageScope.APPLICATION */);
    }
    removeSessionPreference(providerId, mcpServerId, scopes) {
        // The 3 parts of this key are important:
        // * MCP server id: The MCP server that has a preference
        // * Provider id: The provider that the preference is for
        // * The scopes: The subset of sessions that the preference applies to
        const key = `${mcpServerId}-${providerId}-${scopes.join(SCOPESLIST_SEPARATOR)}`;
        // This won't affect any other workspaces that have a preference set, but it will remove the preference
        // for this workspace and the global preference. This is only paired with a call to updateSessionPreference...
        // so we really don't _need_ to remove them as they are about to be overridden anyway... but it's more correct
        // to remove them first... and in case this gets called from somewhere else in the future.
        this.storageService.remove(key, 1 /* StorageScope.WORKSPACE */);
        this.storageService.remove(key, -1 /* StorageScope.APPLICATION */);
    }
    _updateAccountAndSessionPreferences(providerId, mcpServerId, session) {
        this.updateAccountPreference(mcpServerId, providerId, session.account);
        this.updateSessionPreference(providerId, mcpServerId, session);
    }
    //#endregion
    async showGetSessionPrompt(provider, accountName, mcpServerId, mcpServerName) {
        let SessionPromptChoice;
        (function (SessionPromptChoice) {
            SessionPromptChoice[SessionPromptChoice["Allow"] = 0] = "Allow";
            SessionPromptChoice[SessionPromptChoice["Deny"] = 1] = "Deny";
            SessionPromptChoice[SessionPromptChoice["Cancel"] = 2] = "Cancel";
        })(SessionPromptChoice || (SessionPromptChoice = {}));
        const { result } = await this.dialogService.prompt({
            type: Severity.Info,
            message: nls.localize('confirmAuthenticationAccess', "The MCP server '{0}' wants to access the {1} account '{2}'.", mcpServerName, provider.label, accountName),
            buttons: [
                {
                    label: nls.localize({ key: 'allow', comment: ['&& denotes a mnemonic'] }, "&&Allow"),
                    run: () => SessionPromptChoice.Allow
                },
                {
                    label: nls.localize({ key: 'deny', comment: ['&& denotes a mnemonic'] }, "&&Deny"),
                    run: () => SessionPromptChoice.Deny
                }
            ],
            cancelButton: {
                run: () => SessionPromptChoice.Cancel
            }
        });
        if (result !== SessionPromptChoice.Cancel) {
            this._authenticationAccessService.updateAllowedMcpServers(provider.id, accountName, [{ id: mcpServerId, name: mcpServerName, allowed: result === SessionPromptChoice.Allow }]);
            this.removeAccessRequest(provider.id, mcpServerId);
        }
        return result === SessionPromptChoice.Allow;
    }
    /**
     * This function should be used only when there are sessions to disambiguate.
     */
    async selectSession(providerId, mcpServerId, mcpServerName, scopes, availableSessions) {
        const allAccounts = await this._authenticationService.getAccounts(providerId);
        if (!allAccounts.length) {
            throw new Error('No accounts available');
        }
        const disposables = new DisposableStore();
        const quickPick = disposables.add(this.quickInputService.createQuickPick());
        quickPick.ignoreFocusOut = true;
        const accountsWithSessions = new Set();
        const items = availableSessions
            // Only grab the first account
            .filter(session => !accountsWithSessions.has(session.account.label) && accountsWithSessions.add(session.account.label))
            .map(session => {
            return {
                label: session.account.label,
                session: session
            };
        });
        // Add the additional accounts that have been logged into the provider but are
        // don't have a session yet.
        allAccounts.forEach(account => {
            if (!accountsWithSessions.has(account.label)) {
                items.push({ label: account.label, account });
            }
        });
        items.push({ label: nls.localize('useOtherAccount', "Sign in to another account") });
        quickPick.items = items;
        quickPick.title = nls.localize({
            key: 'selectAccount',
            comment: ['The placeholder {0} is the name of a MCP server. {1} is the name of the type of account, such as Microsoft or GitHub.']
        }, "The MCP server '{0}' wants to access a {1} account", mcpServerName, this._authenticationService.getProvider(providerId).label);
        quickPick.placeholder = nls.localize('getSessionPlateholder', "Select an account for '{0}' to use or Esc to cancel", mcpServerName);
        return await new Promise((resolve, reject) => {
            disposables.add(quickPick.onDidAccept(async (_) => {
                quickPick.dispose();
                let session = quickPick.selectedItems[0].session;
                if (!session) {
                    const account = quickPick.selectedItems[0].account;
                    try {
                        session = await this._authenticationService.createSession(providerId, scopes, { account });
                    }
                    catch (e) {
                        reject(e);
                        return;
                    }
                }
                const accountName = session.account.label;
                this._authenticationAccessService.updateAllowedMcpServers(providerId, accountName, [{ id: mcpServerId, name: mcpServerName, allowed: true }]);
                this._updateAccountAndSessionPreferences(providerId, mcpServerId, session);
                this.removeAccessRequest(providerId, mcpServerId);
                resolve(session);
            }));
            disposables.add(quickPick.onDidHide(_ => {
                if (!quickPick.selectedItems[0]) {
                    reject('User did not consent to account access');
                }
                disposables.dispose();
            }));
            quickPick.show();
        });
    }
    async completeSessionAccessRequest(provider, mcpServerId, mcpServerName, scopes) {
        const providerRequests = this._sessionAccessRequestItems.get(provider.id) || {};
        const existingRequest = providerRequests[mcpServerId];
        if (!existingRequest) {
            return;
        }
        if (!provider) {
            return;
        }
        const possibleSessions = existingRequest.possibleSessions;
        let session;
        if (provider.supportsMultipleAccounts) {
            try {
                session = await this.selectSession(provider.id, mcpServerId, mcpServerName, scopes, possibleSessions);
            }
            catch (_) {
                // ignore cancel
            }
        }
        else {
            const approved = await this.showGetSessionPrompt(provider, possibleSessions[0].account.label, mcpServerId, mcpServerName);
            if (approved) {
                session = possibleSessions[0];
            }
        }
        if (session) {
            this._authenticationUsageService.addAccountUsage(provider.id, session.account.label, session.scopes, mcpServerId, mcpServerName);
        }
    }
    requestSessionAccess(providerId, mcpServerId, mcpServerName, scopes, possibleSessions) {
        const providerRequests = this._sessionAccessRequestItems.get(providerId) || {};
        const hasExistingRequest = providerRequests[mcpServerId];
        if (hasExistingRequest) {
            return;
        }
        const provider = this._authenticationService.getProvider(providerId);
        const menuItem = MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
            group: '3_accessRequests',
            command: {
                id: `${providerId}${mcpServerId}Access`,
                title: nls.localize({
                    key: 'accessRequest',
                    comment: [`The placeholder {0} will be replaced with an authentication provider''s label. {1} will be replaced with a MCP server name. (1) is to indicate that this menu item contributes to a badge count`]
                }, "Grant access to {0} for {1}... (1)", provider.label, mcpServerName)
            }
        });
        const accessCommand = CommandsRegistry.registerCommand({
            id: `${providerId}${mcpServerId}Access`,
            handler: async (accessor) => {
                this.completeSessionAccessRequest(provider, mcpServerId, mcpServerName, scopes);
            }
        });
        providerRequests[mcpServerId] = { possibleSessions, disposables: [menuItem, accessCommand] };
        this._sessionAccessRequestItems.set(providerId, providerRequests);
        this.updateBadgeCount();
    }
    async requestNewSession(providerId, scopes, mcpServerId, mcpServerName) {
        if (!this._authenticationService.isAuthenticationProviderRegistered(providerId)) {
            // Activate has already been called for the authentication provider, but it cannot block on registering itself
            // since this is sync and returns a disposable. So, wait for registration event to fire that indicates the
            // provider is now in the map.
            await new Promise((resolve, _) => {
                const dispose = this._authenticationService.onDidRegisterAuthenticationProvider(e => {
                    if (e.id === providerId) {
                        dispose.dispose();
                        resolve();
                    }
                });
            });
        }
        let provider;
        try {
            provider = this._authenticationService.getProvider(providerId);
        }
        catch (_e) {
            return;
        }
        const providerRequests = this._signInRequestItems.get(providerId);
        const scopesList = scopes.join(SCOPESLIST_SEPARATOR);
        const mcpServerHasExistingRequest = providerRequests
            && providerRequests[scopesList]
            && providerRequests[scopesList].requestingMcpServerIds.includes(mcpServerId);
        if (mcpServerHasExistingRequest) {
            return;
        }
        // Construct a commandId that won't clash with others generated here, nor likely with an MCP server's command
        const commandId = `${providerId}:${mcpServerId}:signIn${Object.keys(providerRequests || []).length}`;
        const menuItem = MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
            group: '2_signInRequests',
            command: {
                id: commandId,
                title: nls.localize({
                    key: 'signInRequest',
                    comment: [`The placeholder {0} will be replaced with an authentication provider's label. {1} will be replaced with a MCP server name. (1) is to indicate that this menu item contributes to a badge count.`]
                }, "Sign in with {0} to use {1} (1)", provider.label, mcpServerName)
            }
        });
        const signInCommand = CommandsRegistry.registerCommand({
            id: commandId,
            handler: async (accessor) => {
                const authenticationService = accessor.get(IAuthenticationService);
                const session = await authenticationService.createSession(providerId, scopes);
                this._authenticationAccessService.updateAllowedMcpServers(providerId, session.account.label, [{ id: mcpServerId, name: mcpServerName, allowed: true }]);
                this._updateAccountAndSessionPreferences(providerId, mcpServerId, session);
            }
        });
        if (providerRequests) {
            const existingRequest = providerRequests[scopesList] || { disposables: [], requestingMcpServerIds: [] };
            providerRequests[scopesList] = {
                disposables: [...existingRequest.disposables, menuItem, signInCommand],
                requestingMcpServerIds: [...existingRequest.requestingMcpServerIds, mcpServerId]
            };
            this._signInRequestItems.set(providerId, providerRequests);
        }
        else {
            this._signInRequestItems.set(providerId, {
                [scopesList]: {
                    disposables: [menuItem, signInCommand],
                    requestingMcpServerIds: [mcpServerId]
                }
            });
        }
        this.updateBadgeCount();
    }
};
AuthenticationMcpService = __decorate([
    __param(0, IActivityService),
    __param(1, IStorageService),
    __param(2, IDialogService),
    __param(3, IQuickInputService),
    __param(4, IProductService),
    __param(5, IAuthenticationService),
    __param(6, IAuthenticationMcpUsageService),
    __param(7, IAuthenticationMcpAccessService)
], AuthenticationMcpService);
export { AuthenticationMcpService };
registerSingleton(IAuthenticationMcpService, AuthenticationMcpService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25NY3BTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9hdXRoZW50aWNhdGlvbi9icm93c2VyL2F1dGhlbnRpY2F0aW9uTWNwU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM1SCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDL0QsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3BGLE9BQU8sRUFBa0Qsc0JBQXNCLEVBQWdDLE1BQU0sNkJBQTZCLENBQUM7QUFD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