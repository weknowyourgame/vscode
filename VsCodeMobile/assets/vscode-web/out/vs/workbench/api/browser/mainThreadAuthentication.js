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
import { Disposable, DisposableMap } from '../../../base/common/lifecycle.js';
import * as nls from '../../../nls.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { IAuthenticationService, IAuthenticationExtensionsService, isAuthenticationWwwAuthenticateRequest } from '../../services/authentication/common/authentication.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import Severity from '../../../base/common/severity.js';
import { INotificationService } from '../../../platform/notification/common/notification.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
import { Emitter } from '../../../base/common/event.js';
import { IAuthenticationAccessService } from '../../services/authentication/browser/authenticationAccessService.js';
import { IAuthenticationUsageService } from '../../services/authentication/browser/authenticationUsageService.js';
import { getAuthenticationProviderActivationEvent } from '../../services/authentication/browser/authenticationService.js';
import { URI } from '../../../base/common/uri.js';
import { IOpenerService } from '../../../platform/opener/common/opener.js';
import { CancellationError } from '../../../base/common/errors.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { IURLService } from '../../../platform/url/common/url.js';
import { DeferredPromise, raceTimeout } from '../../../base/common/async.js';
import { IDynamicAuthenticationProviderStorageService } from '../../services/authentication/common/dynamicAuthenticationProviderStorage.js';
import { IClipboardService } from '../../../platform/clipboard/common/clipboardService.js';
import { IQuickInputService } from '../../../platform/quickinput/common/quickInput.js';
import { IProductService } from '../../../platform/product/common/productService.js';
class MainThreadAuthenticationProvider extends Disposable {
    constructor(_proxy, id, label, supportsMultipleAccounts, authorizationServers, resourceServer, onDidChangeSessionsEmitter) {
        super();
        this._proxy = _proxy;
        this.id = id;
        this.label = label;
        this.supportsMultipleAccounts = supportsMultipleAccounts;
        this.authorizationServers = authorizationServers;
        this.resourceServer = resourceServer;
        this.onDidChangeSessions = onDidChangeSessionsEmitter.event;
    }
    async getSessions(scopes, options) {
        return this._proxy.$getSessions(this.id, scopes, options);
    }
    createSession(scopes, options) {
        return this._proxy.$createSession(this.id, scopes, options);
    }
    async removeSession(sessionId) {
        await this._proxy.$removeSession(this.id, sessionId);
    }
}
class MainThreadAuthenticationProviderWithChallenges extends MainThreadAuthenticationProvider {
    constructor(proxy, id, label, supportsMultipleAccounts, authorizationServers, resourceServer, onDidChangeSessionsEmitter) {
        super(proxy, id, label, supportsMultipleAccounts, authorizationServers, resourceServer, onDidChangeSessionsEmitter);
    }
    getSessionsFromChallenges(constraint, options) {
        return this._proxy.$getSessionsFromChallenges(this.id, constraint, options);
    }
    createSessionFromChallenges(constraint, options) {
        return this._proxy.$createSessionFromChallenges(this.id, constraint, options);
    }
}
let MainThreadAuthentication = class MainThreadAuthentication extends Disposable {
    constructor(extHostContext, productService, authenticationService, authenticationExtensionsService, authenticationAccessService, authenticationUsageService, dialogService, notificationService, extensionService, telemetryService, openerService, logService, urlService, dynamicAuthProviderStorageService, clipboardService, quickInputService) {
        super();
        this.productService = productService;
        this.authenticationService = authenticationService;
        this.authenticationExtensionsService = authenticationExtensionsService;
        this.authenticationAccessService = authenticationAccessService;
        this.authenticationUsageService = authenticationUsageService;
        this.dialogService = dialogService;
        this.notificationService = notificationService;
        this.extensionService = extensionService;
        this.telemetryService = telemetryService;
        this.openerService = openerService;
        this.logService = logService;
        this.urlService = urlService;
        this.dynamicAuthProviderStorageService = dynamicAuthProviderStorageService;
        this.clipboardService = clipboardService;
        this.quickInputService = quickInputService;
        this._registrations = this._register(new DisposableMap());
        this._sentProviderUsageEvents = new Set();
        this._suppressUnregisterEvent = false;
        // TODO@TylerLeonhardt this is a temporary addition to telemetry to understand what extensions are overriding the client id.
        // We can use this telemetry to reach out to these extension authors and let them know that they many need configuration changes
        // due to the adoption of the Microsoft broker.
        // Remove this in a few iterations.
        this._sentClientIdUsageEvents = new Set();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostAuthentication);
        this._register(this.authenticationService.onDidChangeSessions(e => this._proxy.$onDidChangeAuthenticationSessions(e.providerId, e.label)));
        this._register(this.authenticationService.onDidUnregisterAuthenticationProvider(e => {
            if (!this._suppressUnregisterEvent) {
                this._proxy.$onDidUnregisterAuthenticationProvider(e.id);
            }
        }));
        this._register(this.authenticationExtensionsService.onDidChangeAccountPreference(e => {
            const providerInfo = this.authenticationService.getProvider(e.providerId);
            this._proxy.$onDidChangeAuthenticationSessions(providerInfo.id, providerInfo.label, e.extensionIds);
        }));
        // Listen for dynamic authentication provider token changes
        this._register(this.dynamicAuthProviderStorageService.onDidChangeTokens(e => {
            this._proxy.$onDidChangeDynamicAuthProviderTokens(e.authProviderId, e.clientId, e.tokens);
        }));
        this._register(authenticationService.registerAuthenticationProviderHostDelegate({
            // Prefer Node.js extension hosts when they're available. No CORS issues etc.
            priority: extHostContext.extensionHostKind === 2 /* ExtensionHostKind.LocalWebWorker */ ? 0 : 1,
            create: async (authorizationServer, serverMetadata, resource) => {
                // Auth Provider Id is a combination of the authorization server and the resource, if provided.
                const authProviderId = resource ? `${authorizationServer.toString(true)} ${resource.resource}` : authorizationServer.toString(true);
                const clientDetails = await this.dynamicAuthProviderStorageService.getClientRegistration(authProviderId);
                let clientId = clientDetails?.clientId;
                const clientSecret = clientDetails?.clientSecret;
                let initialTokens = undefined;
                if (clientId) {
                    initialTokens = await this.dynamicAuthProviderStorageService.getSessionsForDynamicAuthProvider(authProviderId, clientId);
                    // If we don't already have a client id, check if the server supports the Client Id Metadata flow (see docs on the property)
                    // and add the "client id" if so.
                }
                else if (serverMetadata.client_id_metadata_document_supported) {
                    clientId = this.productService.authClientIdMetadataUrl;
                }
                return await this._proxy.$registerDynamicAuthProvider(authorizationServer, serverMetadata, resource, clientId, clientSecret, initialTokens);
            }
        }));
    }
    async $registerAuthenticationProvider({ id, label, supportsMultipleAccounts, resourceServer, supportedAuthorizationServers, supportsChallenges }) {
        if (!this.authenticationService.declaredProviders.find(p => p.id === id)) {
            // If telemetry shows that this is not happening much, we can instead throw an error here.
            this.logService.warn(`Authentication provider ${id} was not declared in the Extension Manifest.`);
            this.telemetryService.publicLog2('authentication.providerNotDeclared', { id });
        }
        const emitter = new Emitter();
        this._registrations.set(id, emitter);
        const supportedAuthorizationServerUris = (supportedAuthorizationServers ?? []).map(i => URI.revive(i));
        const provider = supportsChallenges
            ? new MainThreadAuthenticationProviderWithChallenges(this._proxy, id, label, supportsMultipleAccounts, supportedAuthorizationServerUris, resourceServer ? URI.revive(resourceServer) : undefined, emitter)
            : new MainThreadAuthenticationProvider(this._proxy, id, label, supportsMultipleAccounts, supportedAuthorizationServerUris, resourceServer ? URI.revive(resourceServer) : undefined, emitter);
        this.authenticationService.registerAuthenticationProvider(id, provider);
    }
    async $unregisterAuthenticationProvider(id) {
        this._registrations.deleteAndDispose(id);
        // The ext host side already unregisters the provider, so we can suppress the event here.
        this._suppressUnregisterEvent = true;
        try {
            this.authenticationService.unregisterAuthenticationProvider(id);
        }
        finally {
            this._suppressUnregisterEvent = false;
        }
    }
    async $ensureProvider(id) {
        if (!this.authenticationService.isAuthenticationProviderRegistered(id)) {
            return await this.extensionService.activateByEvent(getAuthenticationProviderActivationEvent(id), 1 /* ActivationKind.Immediate */);
        }
    }
    async $sendDidChangeSessions(providerId, event) {
        const obj = this._registrations.get(providerId);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }
    $removeSession(providerId, sessionId) {
        return this.authenticationService.removeSession(providerId, sessionId);
    }
    async $waitForUriHandler(expectedUri) {
        const deferredPromise = new DeferredPromise();
        const disposable = this.urlService.registerHandler({
            handleURL: async (uri) => {
                if (uri.scheme !== expectedUri.scheme || uri.authority !== expectedUri.authority || uri.path !== expectedUri.path) {
                    return false;
                }
                deferredPromise.complete(uri);
                disposable.dispose();
                return true;
            }
        });
        const result = await raceTimeout(deferredPromise.p, 5 * 60 * 1000); // 5 minutes
        if (!result) {
            throw new Error('Timed out waiting for URI handler');
        }
        return await deferredPromise.p;
    }
    $showContinueNotification(message) {
        const yes = nls.localize('yes', "Yes");
        const no = nls.localize('no', "No");
        const deferredPromise = new DeferredPromise();
        let result = false;
        const handle = this.notificationService.prompt(Severity.Warning, message, [{
                label: yes,
                run: () => result = true
            }, {
                label: no,
                run: () => result = false
            }]);
        const disposable = handle.onDidClose(() => {
            deferredPromise.complete(result);
            disposable.dispose();
        });
        return deferredPromise.p;
    }
    async $registerDynamicAuthenticationProvider(details) {
        await this.$registerAuthenticationProvider({
            id: details.id,
            label: details.label,
            supportsMultipleAccounts: true,
            supportedAuthorizationServers: [details.authorizationServer],
            resourceServer: details.resourceServer,
        });
        await this.dynamicAuthProviderStorageService.storeClientRegistration(details.id, URI.revive(details.authorizationServer).toString(true), details.clientId, details.clientSecret, details.label);
    }
    async $setSessionsForDynamicAuthProvider(authProviderId, clientId, sessions) {
        await this.dynamicAuthProviderStorageService.setSessionsForDynamicAuthProvider(authProviderId, clientId, sessions);
    }
    async $sendDidChangeDynamicProviderInfo({ providerId, clientId, authorizationServer, label, clientSecret }) {
        this.logService.info(`Client ID for authentication provider ${providerId} changed to ${clientId}`);
        const existing = this.dynamicAuthProviderStorageService.getInteractedProviders().find(p => p.providerId === providerId);
        if (!existing) {
            throw new Error(`Dynamic authentication provider ${providerId} not found. Has it been registered?`);
        }
        // Store client credentials together
        await this.dynamicAuthProviderStorageService.storeClientRegistration(providerId || existing.providerId, authorizationServer ? URI.revive(authorizationServer).toString(true) : existing.authorizationServer, clientId || existing.clientId, clientSecret, label || existing.label);
    }
    async loginPrompt(provider, extensionName, recreatingSession, options) {
        let message;
        // Check if the provider has a custom confirmation message
        const customMessage = provider.confirmation?.(extensionName, recreatingSession);
        if (customMessage) {
            message = customMessage;
        }
        else {
            message = recreatingSession
                ? nls.localize('confirmRelogin', "The extension '{0}' wants you to sign in again using {1}.", extensionName, provider.label)
                : nls.localize('confirmLogin', "The extension '{0}' wants to sign in using {1}.", extensionName, provider.label);
        }
        const buttons = [
            {
                label: nls.localize({ key: 'allow', comment: ['&& denotes a mnemonic'] }, "&&Allow"),
                run() {
                    return true;
                },
            }
        ];
        if (options?.learnMore) {
            buttons.push({
                label: nls.localize('learnMore', "Learn more"),
                run: async () => {
                    const result = this.loginPrompt(provider, extensionName, recreatingSession, options);
                    await this.openerService.open(URI.revive(options.learnMore), { allowCommands: true });
                    return await result;
                }
            });
        }
        const { result } = await this.dialogService.prompt({
            type: Severity.Info,
            message,
            buttons,
            detail: options?.detail,
            cancelButton: true,
        });
        return result ?? false;
    }
    async continueWithIncorrectAccountPrompt(chosenAccountLabel, requestedAccountLabel) {
        const result = await this.dialogService.prompt({
            message: nls.localize('incorrectAccount', "Incorrect account detected"),
            detail: nls.localize('incorrectAccountDetail', "The chosen account, {0}, does not match the requested account, {1}.", chosenAccountLabel, requestedAccountLabel),
            type: Severity.Warning,
            cancelButton: true,
            buttons: [
                {
                    label: nls.localize('keep', 'Keep {0}', chosenAccountLabel),
                    run: () => chosenAccountLabel
                },
                {
                    label: nls.localize('loginWith', 'Login with {0}', requestedAccountLabel),
                    run: () => requestedAccountLabel
                }
            ],
        });
        if (!result.result) {
            throw new CancellationError();
        }
        return result.result === chosenAccountLabel;
    }
    async doGetSession(providerId, scopeListOrRequest, extensionId, extensionName, options) {
        const authorizationServer = URI.revive(options.authorizationServer);
        const sessions = await this.authenticationService.getSessions(providerId, scopeListOrRequest, { account: options.account, authorizationServer }, true);
        const provider = this.authenticationService.getProvider(providerId);
        // Error cases
        if (options.forceNewSession && options.createIfNone) {
            throw new Error('Invalid combination of options. Please remove one of the following: forceNewSession, createIfNone');
        }
        if (options.forceNewSession && options.silent) {
            throw new Error('Invalid combination of options. Please remove one of the following: forceNewSession, silent');
        }
        if (options.createIfNone && options.silent) {
            throw new Error('Invalid combination of options. Please remove one of the following: createIfNone, silent');
        }
        if (options.clearSessionPreference) {
            // Clearing the session preference is usually paired with createIfNone, so just remove the preference and
            // defer to the rest of the logic in this function to choose the session.
            this.authenticationExtensionsService.removeAccountPreference(extensionId, providerId);
        }
        const matchingAccountPreferenceSession = 
        // If an account was passed in, that takes precedence over the account preference
        options.account
            // We only support one session per account per set of scopes so grab the first one here
            ? sessions[0]
            : this._getAccountPreference(extensionId, providerId, sessions);
        // Check if the sessions we have are valid
        if (!options.forceNewSession && sessions.length) {
            // If we have an existing session preference, use that. If not, we'll return any valid session at the end of this function.
            if (matchingAccountPreferenceSession && this.authenticationAccessService.isAccessAllowed(providerId, matchingAccountPreferenceSession.account.label, extensionId)) {
                return matchingAccountPreferenceSession;
            }
            // If we only have one account for a single auth provider, lets just check if it's allowed and return it if it is.
            if (!provider.supportsMultipleAccounts && this.authenticationAccessService.isAccessAllowed(providerId, sessions[0].account.label, extensionId)) {
                return sessions[0];
            }
        }
        // We may need to prompt because we don't have a valid session
        // modal flows
        if (options.createIfNone || options.forceNewSession) {
            let uiOptions;
            if (typeof options.forceNewSession === 'object') {
                uiOptions = options.forceNewSession;
            }
            else if (typeof options.createIfNone === 'object') {
                uiOptions = options.createIfNone;
            }
            // We only want to show the "recreating session" prompt if we are using forceNewSession & there are sessions
            // that we will be "forcing through".
            const recreatingSession = !!(options.forceNewSession && sessions.length);
            const isAllowed = await this.loginPrompt(provider, extensionName, recreatingSession, uiOptions);
            if (!isAllowed) {
                throw new Error('User did not consent to login.');
            }
            let session;
            if (sessions?.length && !options.forceNewSession) {
                session = provider.supportsMultipleAccounts && !options.account
                    ? await this.authenticationExtensionsService.selectSession(providerId, extensionId, extensionName, scopeListOrRequest, sessions)
                    : sessions[0];
            }
            else {
                const accountToCreate = options.account ?? matchingAccountPreferenceSession?.account;
                do {
                    session = await this.authenticationService.createSession(providerId, scopeListOrRequest, {
                        activateImmediate: true,
                        account: accountToCreate,
                        authorizationServer
                    });
                } while (accountToCreate
                    && accountToCreate.label !== session.account.label
                    && !await this.continueWithIncorrectAccountPrompt(session.account.label, accountToCreate.label));
            }
            this.authenticationAccessService.updateAllowedExtensions(providerId, session.account.label, [{ id: extensionId, name: extensionName, allowed: true }]);
            this.authenticationExtensionsService.updateNewSessionRequests(providerId, [session]);
            this.authenticationExtensionsService.updateAccountPreference(extensionId, providerId, session.account);
            return session;
        }
        // For the silent flows, if we have a session but we don't have a session preference, we'll return the first one that is valid.
        if (!matchingAccountPreferenceSession && !this.authenticationExtensionsService.getAccountPreference(extensionId, providerId)) {
            const validSession = sessions.find(session => this.authenticationAccessService.isAccessAllowed(providerId, session.account.label, extensionId));
            if (validSession) {
                return validSession;
            }
        }
        // passive flows (silent or default)
        if (!options.silent) {
            // If there is a potential session, but the extension doesn't have access to it, use the "grant access" flow,
            // otherwise request a new one.
            sessions.length
                ? this.authenticationExtensionsService.requestSessionAccess(providerId, extensionId, extensionName, scopeListOrRequest, sessions)
                : await this.authenticationExtensionsService.requestNewSession(providerId, scopeListOrRequest, extensionId, extensionName);
        }
        return undefined;
    }
    async $getSession(providerId, scopeListOrRequest, extensionId, extensionName, options) {
        const scopes = isAuthenticationWwwAuthenticateRequest(scopeListOrRequest) ? scopeListOrRequest.fallbackScopes : scopeListOrRequest;
        if (scopes) {
            this.sendClientIdUsageTelemetry(extensionId, providerId, scopes);
        }
        const session = await this.doGetSession(providerId, scopeListOrRequest, extensionId, extensionName, options);
        if (session) {
            this.sendProviderUsageTelemetry(extensionId, providerId);
            this.authenticationUsageService.addAccountUsage(providerId, session.account.label, session.scopes, extensionId, extensionName);
        }
        return session;
    }
    async $getAccounts(providerId) {
        const accounts = await this.authenticationService.getAccounts(providerId);
        return accounts;
    }
    sendClientIdUsageTelemetry(extensionId, providerId, scopes) {
        const containsVSCodeClientIdScope = scopes.some(scope => scope.startsWith('VSCODE_CLIENT_ID:'));
        const key = `${extensionId}|${providerId}|${containsVSCodeClientIdScope}`;
        if (this._sentClientIdUsageEvents.has(key)) {
            return;
        }
        this._sentClientIdUsageEvents.add(key);
        if (containsVSCodeClientIdScope) {
            this.telemetryService.publicLog2('authentication.clientIdUsage', { extensionId });
        }
    }
    sendProviderUsageTelemetry(extensionId, providerId) {
        const key = `${extensionId}|${providerId}`;
        if (this._sentProviderUsageEvents.has(key)) {
            return;
        }
        this._sentProviderUsageEvents.add(key);
        this.telemetryService.publicLog2('authentication.providerUsage', { providerId, extensionId });
    }
    //#region Account Preferences
    // TODO@TylerLeonhardt: Update this after a few iterations to no longer fallback to the session preference
    _getAccountPreference(extensionId, providerId, sessions) {
        if (sessions.length === 0) {
            return undefined;
        }
        const accountNamePreference = this.authenticationExtensionsService.getAccountPreference(extensionId, providerId);
        if (accountNamePreference) {
            const session = sessions.find(session => session.account.label === accountNamePreference);
            return session;
        }
        return undefined;
    }
    //#endregion
    async $showDeviceCodeModal(userCode, verificationUri) {
        const { result } = await this.dialogService.prompt({
            type: Severity.Info,
            message: nls.localize('deviceCodeTitle', "Device Code Authentication"),
            detail: nls.localize('deviceCodeDetail', "Your code: {0}\n\nTo complete authentication, navigate to {1} and enter the code above.", userCode, verificationUri),
            buttons: [
                {
                    label: nls.localize('copyAndContinue', "Copy & Continue"),
                    run: () => true
                }
            ],
            cancelButton: true
        });
        if (result) {
            // Open verification URI
            try {
                await this.clipboardService.writeText(userCode);
                return await this.openerService.open(URI.parse(verificationUri));
            }
            catch (error) {
                this.notificationService.error(nls.localize('failedToOpenUri', "Failed to open {0}", verificationUri));
            }
        }
        return false;
    }
    async $promptForClientRegistration(authorizationServerUrl) {
        const redirectUrls = 'http://127.0.0.1:33418\nhttps://vscode.dev/redirect';
        // Show modal dialog first to explain the situation and get user consent
        const result = await this.dialogService.prompt({
            type: Severity.Info,
            message: nls.localize('dcrNotSupported', "Dynamic Client Registration not supported"),
            detail: nls.localize('dcrNotSupportedDetail', "The authorization server '{0}' does not support automatic client registration. Do you want to proceed by manually providing a client registration (client ID)?\n\nNote: When registering your OAuth application, make sure to include these redirect URIs:\n{1}", authorizationServerUrl, redirectUrls),
            buttons: [
                {
                    label: nls.localize('dcrCopyUrlsAndProceed', "Copy URIs & Proceed"),
                    run: async () => {
                        try {
                            await this.clipboardService.writeText(redirectUrls);
                        }
                        catch (error) {
                            this.notificationService.error(nls.localize('dcrFailedToCopy', "Failed to copy redirect URIs to clipboard."));
                        }
                        return true;
                    }
                },
            ],
            cancelButton: {
                label: nls.localize('cancel', "Cancel"),
                run: () => false
            }
        });
        if (!result) {
            return undefined;
        }
        const sharedTitle = nls.localize('addClientRegistrationDetails', "Add Client Registration Details");
        const clientId = await this.quickInputService.input({
            title: sharedTitle,
            prompt: nls.localize('clientIdPrompt', "Enter an existing client ID that has been registered with the following redirect URIs: http://127.0.0.1:33418, https://vscode.dev/redirect"),
            placeHolder: nls.localize('clientIdPlaceholder', "OAuth client ID (azye39d...)"),
            ignoreFocusLost: true,
            validateInput: async (value) => {
                if (!value || value.trim().length === 0) {
                    return nls.localize('clientIdRequired', "Client ID is required");
                }
                return undefined;
            }
        });
        if (!clientId || clientId.trim().length === 0) {
            return undefined;
        }
        const clientSecret = await this.quickInputService.input({
            title: sharedTitle,
            prompt: nls.localize('clientSecretPrompt', "(optional) Enter an existing client secret associated with the client id '{0}' or leave this field blank", clientId),
            placeHolder: nls.localize('clientSecretPlaceholder', "OAuth client secret (wer32o50f...) or leave it blank"),
            password: true,
            ignoreFocusLost: true
        });
        return {
            clientId: clientId.trim(),
            clientSecret: clientSecret?.trim() || undefined
        };
    }
};
MainThreadAuthentication = __decorate([
    extHostNamedCustomer(MainContext.MainThreadAuthentication),
    __param(1, IProductService),
    __param(2, IAuthenticationService),
    __param(3, IAuthenticationExtensionsService),
    __param(4, IAuthenticationAccessService),
    __param(5, IAuthenticationUsageService),
    __param(6, IDialogService),
    __param(7, INotificationService),
    __param(8, IExtensionService),
    __param(9, ITelemetryService),
    __param(10, IOpenerService),
    __param(11, ILogService),
    __param(12, IURLService),
    __param(13, IDynamicAuthenticationProviderStorageService),
    __param(14, IClipboardService),
    __param(15, IQuickInputService)
], MainThreadAuthentication);
export { MainThreadAuthentication };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZEF1dGhlbnRpY2F0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkQXV0aGVudGljYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM5RSxPQUFPLEtBQUssR0FBRyxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxvQkFBb0IsRUFBbUIsTUFBTSxzREFBc0QsQ0FBQztBQUM3RyxPQUFPLEVBQXFGLHNCQUFzQixFQUFFLGdDQUFnQyxFQUF1RSxzQ0FBc0MsRUFBb0UsTUFBTSx3REFBd0QsQ0FBQztBQUNwWSxPQUFPLEVBQThCLGNBQWMsRUFBeUYsV0FBVyxFQUFpQyxNQUFNLCtCQUErQixDQUFDO0FBQzlOLE9BQU8sRUFBRSxjQUFjLEVBQWlCLE1BQU0sNkNBQTZDLENBQUM7QUFDNUYsT0FBTyxRQUFRLE1BQU0sa0NBQWtDLENBQUM7QUFDeEQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDN0YsT0FBTyxFQUFrQixpQkFBaUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxzRUFBc0UsQ0FBQztBQUNwSCxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUNsSCxPQUFPLEVBQUUsd0NBQXdDLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUMxSCxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLDZC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