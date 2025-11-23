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
import { IAuthenticationAccessService } from './authenticationAccessService.js';
import { IAuthenticationUsageService } from './authenticationUsageService.js';
import { IAuthenticationService, IAuthenticationExtensionsService, isAuthenticationWwwAuthenticateRequest } from '../common/authentication.js';
import { Emitter } from '../../../../base/common/event.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
// OAuth2 spec prohibits space in a scope, so use that to join them.
const SCOPESLIST_SEPARATOR = ' ';
// TODO@TylerLeonhardt: This should all go in MainThreadAuthentication
let AuthenticationExtensionsService = class AuthenticationExtensionsService extends Disposable {
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
        this._register(this._authenticationService.onDidChangeSessions(e => {
            if (e.event.added?.length) {
                this.updateNewSessionRequests(e.providerId, e.event.added);
            }
            if (e.event.removed?.length) {
                this.updateAccessRequests(e.providerId, e.event.removed);
            }
        }));
        this._register(this._authenticationService.onDidUnregisterAuthenticationProvider(e => {
            const accessRequests = this._sessionAccessRequestItems.get(e.id) || {};
            Object.keys(accessRequests).forEach(extensionId => {
                this.removeAccessRequest(e.id, extensionId);
            });
        }));
    }
    updateNewSessionRequests(providerId, addedSessions) {
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
                this.updateBadgeCount();
            }
        });
    }
    updateAccessRequests(providerId, removedSessions) {
        const providerRequests = this._sessionAccessRequestItems.get(providerId);
        if (providerRequests) {
            Object.keys(providerRequests).forEach(extensionId => {
                removedSessions.forEach(removed => {
                    const indexOfSession = providerRequests[extensionId].possibleSessions.findIndex(session => session.id === removed.id);
                    if (indexOfSession) {
                        providerRequests[extensionId].possibleSessions.splice(indexOfSession, 1);
                    }
                });
                if (!providerRequests[extensionId].possibleSessions.length) {
                    this.removeAccessRequest(providerId, extensionId);
                }
            });
        }
    }
    updateBadgeCount() {
        this._accountBadgeDisposable.clear();
        let numberOfRequests = 0;
        this._signInRequestItems.forEach(providerRequests => {
            Object.keys(providerRequests).forEach(request => {
                numberOfRequests += providerRequests[request].requestingExtensionIds.length;
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
    removeAccessRequest(providerId, extensionId) {
        const providerRequests = this._sessionAccessRequestItems.get(providerId) || {};
        if (providerRequests[extensionId]) {
            dispose(providerRequests[extensionId].disposables);
            delete providerRequests[extensionId];
            this.updateBadgeCount();
        }
    }
    //#region Account/Session Preference
    updateAccountPreference(extensionId, providerId, account) {
        const realExtensionId = ExtensionIdentifier.toKey(extensionId);
        const parentExtensionId = this._inheritAuthAccountPreferenceChildToParent[realExtensionId] ?? realExtensionId;
        const key = this._getKey(parentExtensionId, providerId);
        // Store the preference in the workspace and application storage. This allows new workspaces to
        // have a preference set already to limit the number of prompts that are shown... but also allows
        // a specific workspace to override the global preference.
        this.storageService.store(key, account.label, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        this.storageService.store(key, account.label, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        const childrenExtensions = this._inheritAuthAccountPreferenceParentToChildren[parentExtensionId];
        const extensionIds = childrenExtensions ? [parentExtensionId, ...childrenExtensions] : [parentExtensionId];
        this._onDidAccountPreferenceChange.fire({ extensionIds, providerId });
    }
    getAccountPreference(extensionId, providerId) {
        const realExtensionId = ExtensionIdentifier.toKey(extensionId);
        const key = this._getKey(this._inheritAuthAccountPreferenceChildToParent[realExtensionId] ?? realExtensionId, providerId);
        // If a preference is set in the workspace, use that. Otherwise, use the global preference.
        return this.storageService.get(key, 1 /* StorageScope.WORKSPACE */) ?? this.storageService.get(key, -1 /* StorageScope.APPLICATION */);
    }
    removeAccountPreference(extensionId, providerId) {
        const realExtensionId = ExtensionIdentifier.toKey(extensionId);
        const key = this._getKey(this._inheritAuthAccountPreferenceChildToParent[realExtensionId] ?? realExtensionId, providerId);
        // This won't affect any other workspaces that have a preference set, but it will remove the preference
        // for this workspace and the global preference. This is only paired with a call to updateSessionPreference...
        // so we really don't _need_ to remove them as they are about to be overridden anyway... but it's more correct
        // to remove them first... and in case this gets called from somewhere else in the future.
        this.storageService.remove(key, 1 /* StorageScope.WORKSPACE */);
        this.storageService.remove(key, -1 /* StorageScope.APPLICATION */);
    }
    _getKey(extensionId, providerId) {
        return `${extensionId}-${providerId}`;
    }
    // TODO@TylerLeonhardt: Remove all of this after a couple iterations
    updateSessionPreference(providerId, extensionId, session) {
        const realExtensionId = ExtensionIdentifier.toKey(extensionId);
        // The 3 parts of this key are important:
        // * Extension id: The extension that has a preference
        // * Provider id: The provider that the preference is for
        // * The scopes: The subset of sessions that the preference applies to
        const key = `${realExtensionId}-${providerId}-${session.scopes.join(SCOPESLIST_SEPARATOR)}`;
        // Store the preference in the workspace and application storage. This allows new workspaces to
        // have a preference set already to limit the number of prompts that are shown... but also allows
        // a specific workspace to override the global preference.
        this.storageService.store(key, session.id, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        this.storageService.store(key, session.id, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
    }
    getSessionPreference(providerId, extensionId, scopes) {
        const realExtensionId = ExtensionIdentifier.toKey(extensionId);
        // The 3 parts of this key are important:
        // * Extension id: The extension that has a preference
        // * Provider id: The provider that the preference is for
        // * The scopes: The subset of sessions that the preference applies to
        const key = `${realExtensionId}-${providerId}-${scopes.join(SCOPESLIST_SEPARATOR)}`;
        // If a preference is set in the workspace, use that. Otherwise, use the global preference.
        return this.storageService.get(key, 1 /* StorageScope.WORKSPACE */) ?? this.storageService.get(key, -1 /* StorageScope.APPLICATION */);
    }
    removeSessionPreference(providerId, extensionId, scopes) {
        const realExtensionId = ExtensionIdentifier.toKey(extensionId);
        // The 3 parts of this key are important:
        // * Extension id: The extension that has a preference
        // * Provider id: The provider that the preference is for
        // * The scopes: The subset of sessions that the preference applies to
        const key = `${realExtensionId}-${providerId}-${scopes.join(SCOPESLIST_SEPARATOR)}`;
        // This won't affect any other workspaces that have a preference set, but it will remove the preference
        // for this workspace and the global preference. This is only paired with a call to updateSessionPreference...
        // so we really don't _need_ to remove them as they are about to be overridden anyway... but it's more correct
        // to remove them first... and in case this gets called from somewhere else in the future.
        this.storageService.remove(key, 1 /* StorageScope.WORKSPACE */);
        this.storageService.remove(key, -1 /* StorageScope.APPLICATION */);
    }
    _updateAccountAndSessionPreferences(providerId, extensionId, session) {
        this.updateAccountPreference(extensionId, providerId, session.account);
        this.updateSessionPreference(providerId, extensionId, session);
    }
    //#endregion
    async showGetSessionPrompt(provider, accountName, extensionId, extensionName) {
        let SessionPromptChoice;
        (function (SessionPromptChoice) {
            SessionPromptChoice[SessionPromptChoice["Allow"] = 0] = "Allow";
            SessionPromptChoice[SessionPromptChoice["Deny"] = 1] = "Deny";
            SessionPromptChoice[SessionPromptChoice["Cancel"] = 2] = "Cancel";
        })(SessionPromptChoice || (SessionPromptChoice = {}));
        const { result } = await this.dialogService.prompt({
            type: Severity.Info,
            message: nls.localize('confirmAuthenticationAccess', "The extension '{0}' wants to access the {1} account '{2}'.", extensionName, provider.label, accountName),
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
            this._authenticationAccessService.updateAllowedExtensions(provider.id, accountName, [{ id: extensionId, name: extensionName, allowed: result === SessionPromptChoice.Allow }]);
            this.removeAccessRequest(provider.id, extensionId);
        }
        return result === SessionPromptChoice.Allow;
    }
    /**
     * This function should be used only when there are sessions to disambiguate.
     */
    async selectSession(providerId, extensionId, extensionName, scopeListOrRequest, availableSessions) {
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
            comment: ['The placeholder {0} is the name of an extension. {1} is the name of the type of account, such as Microsoft or GitHub.']
        }, "The extension '{0}' wants to access a {1} account", extensionName, this._authenticationService.getProvider(providerId).label);
        quickPick.placeholder = nls.localize('getSessionPlateholder', "Select an account for '{0}' to use or Esc to cancel", extensionName);
        return await new Promise((resolve, reject) => {
            disposables.add(quickPick.onDidAccept(async (_) => {
                quickPick.dispose();
                let session = quickPick.selectedItems[0].session;
                if (!session) {
                    const account = quickPick.selectedItems[0].account;
                    try {
                        session = await this._authenticationService.createSession(providerId, scopeListOrRequest, { account });
                    }
                    catch (e) {
                        reject(e);
                        return;
                    }
                }
                const accountName = session.account.label;
                this._authenticationAccessService.updateAllowedExtensions(providerId, accountName, [{ id: extensionId, name: extensionName, allowed: true }]);
                this._updateAccountAndSessionPreferences(providerId, extensionId, session);
                this.removeAccessRequest(providerId, extensionId);
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
    async completeSessionAccessRequest(provider, extensionId, extensionName, scopeListOrRequest) {
        const providerRequests = this._sessionAccessRequestItems.get(provider.id) || {};
        const existingRequest = providerRequests[extensionId];
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
                session = await this.selectSession(provider.id, extensionId, extensionName, scopeListOrRequest, possibleSessions);
            }
            catch (_) {
                // ignore cancel
            }
        }
        else {
            const approved = await this.showGetSessionPrompt(provider, possibleSessions[0].account.label, extensionId, extensionName);
            if (approved) {
                session = possibleSessions[0];
            }
        }
        if (session) {
            this._authenticationUsageService.addAccountUsage(provider.id, session.account.label, session.scopes, extensionId, extensionName);
        }
    }
    requestSessionAccess(providerId, extensionId, extensionName, scopeListOrRequest, possibleSessions) {
        const providerRequests = this._sessionAccessRequestItems.get(providerId) || {};
        const hasExistingRequest = providerRequests[extensionId];
        if (hasExistingRequest) {
            return;
        }
        const provider = this._authenticationService.getProvider(providerId);
        const menuItem = MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
            group: '3_accessRequests',
            command: {
                id: `${providerId}${extensionId}Access`,
                title: nls.localize({
                    key: 'accessRequest',
                    comment: [`The placeholder {0} will be replaced with an authentication provider''s label. {1} will be replaced with an extension name. (1) is to indicate that this menu item contributes to a badge count`]
                }, "Grant access to {0} for {1}... (1)", provider.label, extensionName)
            }
        });
        const accessCommand = CommandsRegistry.registerCommand({
            id: `${providerId}${extensionId}Access`,
            handler: async (accessor) => {
                this.completeSessionAccessRequest(provider, extensionId, extensionName, scopeListOrRequest);
            }
        });
        providerRequests[extensionId] = { possibleSessions, disposables: [menuItem, accessCommand] };
        this._sessionAccessRequestItems.set(providerId, providerRequests);
        this.updateBadgeCount();
    }
    async requestNewSession(providerId, scopeListOrRequest, extensionId, extensionName) {
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
        const signInRequestKey = isAuthenticationWwwAuthenticateRequest(scopeListOrRequest)
            ? `${scopeListOrRequest.wwwAuthenticate}:${scopeListOrRequest.fallbackScopes?.join(SCOPESLIST_SEPARATOR) ?? ''}`
            : `${scopeListOrRequest.join(SCOPESLIST_SEPARATOR)}`;
        const extensionHasExistingRequest = providerRequests
            && providerRequests[signInRequestKey]
            && providerRequests[signInRequestKey].requestingExtensionIds.includes(extensionId);
        if (extensionHasExistingRequest) {
            return;
        }
        // Construct a commandId that won't clash with others generated here, nor likely with an extension's command
        const commandId = `${providerId}:${extensionId}:signIn${Object.keys(providerRequests || []).length}`;
        const menuItem = MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
            group: '2_signInRequests',
            command: {
                id: commandId,
                title: nls.localize({
                    key: 'signInRequest',
                    comment: [`The placeholder {0} will be replaced with an authentication provider's label. {1} will be replaced with an extension name. (1) is to indicate that this menu item contributes to a badge count.`]
                }, "Sign in with {0} to use {1} (1)", provider.label, extensionName)
            }
        });
        const signInCommand = CommandsRegistry.registerCommand({
            id: commandId,
            handler: async (accessor) => {
                const authenticationService = accessor.get(IAuthenticationService);
                const session = await authenticationService.createSession(providerId, scopeListOrRequest);
                this._authenticationAccessService.updateAllowedExtensions(providerId, session.account.label, [{ id: extensionId, name: extensionName, allowed: true }]);
                this._updateAccountAndSessionPreferences(providerId, extensionId, session);
            }
        });
        if (providerRequests) {
            const existingRequest = providerRequests[signInRequestKey] || { disposables: [], requestingExtensionIds: [] };
            providerRequests[signInRequestKey] = {
                disposables: [...existingRequest.disposables, menuItem, signInCommand],
                requestingExtensionIds: [...existingRequest.requestingExtensionIds, extensionId]
            };
            this._signInRequestItems.set(providerId, providerRequests);
        }
        else {
            this._signInRequestItems.set(providerId, {
                [signInRequestKey]: {
                    disposables: [menuItem, signInCommand],
                    requestingExtensionIds: [extensionId]
                }
            });
        }
        this.updateBadgeCount();
    }
};
AuthenticationExtensionsService = __decorate([
    __param(0, IActivityService),
    __param(1, IStorageService),
    __param(2, IDialogService),
    __param(3, IQuickInputService),
    __param(4, IProductService),
    __param(5, IAuthenticationService),
    __param(6, IAuthenticationUsageService),
    __param(7, IAuthenticationAccessService)
], AuthenticationExtensionsService);
export { AuthenticationExtensionsService };
registerSingleton(IAuthenticationExtensionsService, AuthenticationExtensionsService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvYXV0aGVudGljYXRpb24vYnJvd3Nlci9hdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBZSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzVILE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRCxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDdEYsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDcEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2hGLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDcEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDbEYsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDaEYsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDOUUsT0FBTyxFQUFrRCxzQkFBc0IsRUFBRSxnQ0FBZ0Ms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