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
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IAuthenticationService } from '../../authentication/common/authentication.js';
import { asJson, IRequestService } from '../../../../platform/request/common/request.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { localize } from '../../../../nls.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { Barrier } from '../../../../base/common/async.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { isString } from '../../../../base/common/types.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { isWeb } from '../../../../base/common/platform.js';
export const DEFAULT_ACCOUNT_SIGN_IN_COMMAND = 'workbench.actions.accounts.signIn';
var DefaultAccountStatus;
(function (DefaultAccountStatus) {
    DefaultAccountStatus["Uninitialized"] = "uninitialized";
    DefaultAccountStatus["Unavailable"] = "unavailable";
    DefaultAccountStatus["Available"] = "available";
})(DefaultAccountStatus || (DefaultAccountStatus = {}));
const CONTEXT_DEFAULT_ACCOUNT_STATE = new RawContextKey('defaultAccountStatus', "uninitialized" /* DefaultAccountStatus.Uninitialized */);
export const IDefaultAccountService = createDecorator('defaultAccountService');
export class DefaultAccountService extends Disposable {
    constructor() {
        super(...arguments);
        this._defaultAccount = undefined;
        this.initBarrier = new Barrier();
        this._onDidChangeDefaultAccount = this._register(new Emitter());
        this.onDidChangeDefaultAccount = this._onDidChangeDefaultAccount.event;
    }
    get defaultAccount() { return this._defaultAccount ?? null; }
    async getDefaultAccount() {
        await this.initBarrier.wait();
        return this.defaultAccount;
    }
    setDefaultAccount(account) {
        const oldAccount = this._defaultAccount;
        this._defaultAccount = account;
        if (oldAccount !== this._defaultAccount) {
            this._onDidChangeDefaultAccount.fire(this._defaultAccount);
        }
        this.initBarrier.open();
    }
}
let DefaultAccountManagementContribution = class DefaultAccountManagementContribution extends Disposable {
    static { this.ID = 'workbench.contributions.defaultAccountManagement'; }
    constructor(defaultAccountService, configurationService, authenticationService, extensionService, productService, requestService, logService, environmentService, contextKeyService) {
        super();
        this.defaultAccountService = defaultAccountService;
        this.configurationService = configurationService;
        this.authenticationService = authenticationService;
        this.extensionService = extensionService;
        this.productService = productService;
        this.requestService = requestService;
        this.logService = logService;
        this.environmentService = environmentService;
        this.defaultAccount = null;
        this.accountStatusContext = CONTEXT_DEFAULT_ACCOUNT_STATE.bindTo(contextKeyService);
        this.initialize();
    }
    async initialize() {
        this.logService.debug('[DefaultAccount] Starting initialization');
        if (!this.productService.defaultAccount) {
            this.logService.debug('[DefaultAccount] No default account configuration in product service, skipping initialization');
            return;
        }
        if (isWeb && !this.environmentService.remoteAuthority) {
            this.logService.debug('[DefaultAccount] Running in web without remote, skipping initialization');
            return;
        }
        const defaultAccountProviderId = this.getDefaultAccountProviderId();
        this.logService.debug('[DefaultAccount] Default account provider ID:', defaultAccountProviderId);
        if (!defaultAccountProviderId) {
            return;
        }
        await this.extensionService.whenInstalledExtensionsRegistered();
        this.logService.debug('[DefaultAccount] Installed extensions registered.');
        const declaredProvider = this.authenticationService.declaredProviders.find(provider => provider.id === defaultAccountProviderId);
        if (!declaredProvider) {
            this.logService.info(`[DefaultAccount] Authentication provider is not declared.`, defaultAccountProviderId);
            return;
        }
        this.registerSignInAction(defaultAccountProviderId, this.productService.defaultAccount.authenticationProvider.scopes[0]);
        this.setDefaultAccount(await this.getDefaultAccountFromAuthenticatedSessions(defaultAccountProviderId, this.productService.defaultAccount.authenticationProvider.scopes));
        this._register(this.authenticationService.onDidChangeSessions(async (e) => {
            if (e.providerId !== this.getDefaultAccountProviderId()) {
                return;
            }
            if (this.defaultAccount && e.event.removed?.some(session => session.id === this.defaultAccount?.sessionId)) {
                this.setDefaultAccount(null);
                return;
            }
            this.setDefaultAccount(await this.getDefaultAccountFromAuthenticatedSessions(defaultAccountProviderId, this.productService.defaultAccount.authenticationProvider.scopes));
        }));
        this.logService.debug('[DefaultAccount] Initialization complete');
    }
    setDefaultAccount(account) {
        this.defaultAccount = account;
        this.defaultAccountService.setDefaultAccount(this.defaultAccount);
        if (this.defaultAccount) {
            this.accountStatusContext.set("available" /* DefaultAccountStatus.Available */);
            this.logService.debug('[DefaultAccount] Account status set to Available');
        }
        else {
            this.accountStatusContext.set("unavailable" /* DefaultAccountStatus.Unavailable */);
            this.logService.debug('[DefaultAccount] Account status set to Unavailable');
        }
    }
    extractFromToken(token) {
        const result = new Map();
        const firstPart = token?.split(':')[0];
        const fields = firstPart?.split(';');
        for (const field of fields) {
            const [key, value] = field.split('=');
            result.set(key, value);
        }
        this.logService.debug(`[DefaultAccount] extractFromToken: ${JSON.stringify(Object.fromEntries(result))}`);
        return result;
    }
    async getDefaultAccountFromAuthenticatedSessions(authProviderId, scopes) {
        try {
            this.logService.debug('[DefaultAccount] Getting Default Account from authenticated sessions for provider:', authProviderId);
            const session = await this.findMatchingProviderSession(authProviderId, scopes);
            if (!session) {
                this.logService.debug('[DefaultAccount] No matching session found for provider:', authProviderId);
                return null;
            }
            const [chatEntitlements, tokenEntitlements] = await Promise.all([
                this.getChatEntitlements(session.accessToken),
                this.getTokenEntitlements(session.accessToken),
            ]);
            const mcpRegistryProvider = tokenEntitlements.mcp ? await this.getMcpRegistryProvider(session.accessToken) : undefined;
            const account = {
                sessionId: session.id,
                enterprise: this.isEnterpriseAuthenticationProvider(authProviderId) || session.account.label.includes('_'),
                ...chatEntitlements,
                ...tokenEntitlements,
                mcpRegistryUrl: mcpRegistryProvider?.url,
                mcpAccess: mcpRegistryProvider?.registry_access,
            };
            this.logService.debug('[DefaultAccount] Successfully created default account for provider:', authProviderId);
            return account;
        }
        catch (error) {
            this.logService.error('[DefaultAccount] Failed to create default account for provider:', authProviderId, getErrorMessage(error));
            return null;
        }
    }
    async findMatchingProviderSession(authProviderId, allScopes) {
        const sessions = await this.authenticationService.getSessions(authProviderId, undefined, undefined, true);
        for (const session of sessions) {
            this.logService.debug('[DefaultAccount] Checking session with scopes', session.scopes);
            for (const scopes of allScopes) {
                if (this.scopesMatch(session.scopes, scopes)) {
                    return session;
                }
            }
        }
        return undefined;
    }
    scopesMatch(scopes, expectedScopes) {
        return scopes.length === expectedScopes.length && expectedScopes.every(scope => scopes.includes(scope));
    }
    async getTokenEntitlements(accessToken) {
        const tokenEntitlementsUrl = this.getTokenEntitlementUrl();
        if (!tokenEntitlementsUrl) {
            this.logService.debug('[DefaultAccount] No token entitlements URL found');
            return {};
        }
        this.logService.debug('[DefaultAccount] Fetching token entitlements from:', tokenEntitlementsUrl);
        try {
            const chatContext = await this.requestService.request({
                type: 'GET',
                url: tokenEntitlementsUrl,
                disableCache: true,
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }, CancellationToken.None);
            const chatData = await asJson(chatContext);
            if (chatData) {
                const tokenMap = this.extractFromToken(chatData.token);
                return {
                    // Editor preview features are disabled if the flag is present and set to 0
                    chat_preview_features_enabled: tokenMap.get('editor_preview_features') !== '0',
                    chat_agent_enabled: tokenMap.get('agent_mode') !== '0',
                    // MCP is disabled if the flag is present and set to 0
                    mcp: tokenMap.get('mcp') !== '0',
                };
            }
            this.logService.error('Failed to fetch token entitlements', 'No data returned');
        }
        catch (error) {
            this.logService.error('Failed to fetch token entitlements', getErrorMessage(error));
        }
        return {};
    }
    async getChatEntitlements(accessToken) {
        const chatEntitlementsUrl = this.getChatEntitlementUrl();
        if (!chatEntitlementsUrl) {
            this.logService.debug('[DefaultAccount] No chat entitlements URL found');
            return {};
        }
        this.logService.debug('[DefaultAccount] Fetching chat entitlements from:', chatEntitlementsUrl);
        try {
            const context = await this.requestService.request({
                type: 'GET',
                url: chatEntitlementsUrl,
                disableCache: true,
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }, CancellationToken.None);
            const data = await asJson(context);
            if (data) {
                return data;
            }
            this.logService.error('Failed to fetch entitlements', 'No data returned');
        }
        catch (error) {
            this.logService.error('Failed to fetch entitlements', getErrorMessage(error));
        }
        return {};
    }
    async getMcpRegistryProvider(accessToken) {
        const mcpRegistryDataUrl = this.getMcpRegistryDataUrl();
        if (!mcpRegistryDataUrl) {
            this.logService.debug('[DefaultAccount] No MCP registry data URL found');
            return undefined;
        }
        try {
            const context = await this.requestService.request({
                type: 'GET',
                url: mcpRegistryDataUrl,
                disableCache: true,
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }, CancellationToken.None);
            const data = await asJson(context);
            if (data) {
                this.logService.debug('Fetched MCP registry providers', data.mcp_registries);
                return data.mcp_registries[0];
            }
            this.logService.debug('Failed to fetch MCP registry providers', 'No data returned');
        }
        catch (error) {
            this.logService.error('Failed to fetch MCP registry providers', getErrorMessage(error));
        }
        return undefined;
    }
    getChatEntitlementUrl() {
        if (!this.productService.defaultAccount) {
            return undefined;
        }
        if (this.isEnterpriseAuthenticationProvider(this.getDefaultAccountProviderId())) {
            try {
                const enterpriseUrl = this.getEnterpriseUrl();
                if (!enterpriseUrl) {
                    return undefined;
                }
                return `${enterpriseUrl.protocol}//api.${enterpriseUrl.hostname}${enterpriseUrl.port ? ':' + enterpriseUrl.port : ''}/copilot_internal/user`;
            }
            catch (error) {
                this.logService.error(error);
            }
        }
        return this.productService.defaultAccount?.chatEntitlementUrl;
    }
    getTokenEntitlementUrl() {
        if (!this.productService.defaultAccount) {
            return undefined;
        }
        if (this.isEnterpriseAuthenticationProvider(this.getDefaultAccountProviderId())) {
            try {
                const enterpriseUrl = this.getEnterpriseUrl();
                if (!enterpriseUrl) {
                    return undefined;
                }
                return `${enterpriseUrl.protocol}//api.${enterpriseUrl.hostname}${enterpriseUrl.port ? ':' + enterpriseUrl.port : ''}/copilot_internal/v2/token`;
            }
            catch (error) {
                this.logService.error(error);
            }
        }
        return this.productService.defaultAccount?.tokenEntitlementUrl;
    }
    getMcpRegistryDataUrl() {
        if (!this.productService.defaultAccount) {
            return undefined;
        }
        if (this.isEnterpriseAuthenticationProvider(this.getDefaultAccountProviderId())) {
            try {
                const enterpriseUrl = this.getEnterpriseUrl();
                if (!enterpriseUrl) {
                    return undefined;
                }
                return `${enterpriseUrl.protocol}//api.${enterpriseUrl.hostname}${enterpriseUrl.port ? ':' + enterpriseUrl.port : ''}/copilot/mcp_registry`;
            }
            catch (error) {
                this.logService.error(error);
            }
        }
        return this.productService.defaultAccount?.mcpRegistryDataUrl;
    }
    getDefaultAccountProviderId() {
        if (this.productService.defaultAccount && this.configurationService.getValue(this.productService.defaultAccount.authenticationProvider.enterpriseProviderConfig) === this.productService.defaultAccount?.authenticationProvider.enterpriseProviderId) {
            return this.productService.defaultAccount?.authenticationProvider.enterpriseProviderId;
        }
        return this.productService.defaultAccount?.authenticationProvider.id;
    }
    isEnterpriseAuthenticationProvider(providerId) {
        if (!providerId) {
            return false;
        }
        return providerId === this.productService.defaultAccount?.authenticationProvider.enterpriseProviderId;
    }
    getEnterpriseUrl() {
        if (!this.productService.defaultAccount) {
            return undefined;
        }
        const value = this.configurationService.getValue(this.productService.defaultAccount.authenticationProvider.enterpriseProviderUriSetting);
        if (!isString(value)) {
            return undefined;
        }
        return new URL(value);
    }
    registerSignInAction(authProviderId, scopes) {
        const that = this;
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: DEFAULT_ACCOUNT_SIGN_IN_COMMAND,
                    title: localize('sign in', "Sign in"),
                });
            }
            run() {
                return that.authenticationService.createSession(authProviderId, scopes);
            }
        }));
    }
};
DefaultAccountManagementContribution = __decorate([
    __param(0, IDefaultAccountService),
    __param(1, IConfigurationService),
    __param(2, IAuthenticationService),
    __param(3, IExtensionService),
    __param(4, IProductService),
    __param(5, IRequestService),
    __param(6, ILogService),
    __param(7, IWorkbenchEnvironmentService),
    __param(8, IContextKeyService)
], DefaultAccountManagementContribution);
export { DefaultAccountManagementContribution };
registerWorkbenchContribution2('workbench.contributions.defaultAccountManagement', DefaultAccountManagementContribution, 3 /* WorkbenchPhase.AfterRestored */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdEFjY291bnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2FjY291bnRzL2NvbW1vbi9kZWZhdWx0QWNjb3VudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDN0YsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDeEYsT0FBTyxFQUF5QixzQkFBc0IsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzlHLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDekYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JFLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0SCxPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQTBCLDhCQUE4QixFQUFrQixNQUFNLGtDQUFrQyxDQUFDO0FBQzFILE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxP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