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
var ChatEntitlementRequests_1, ChatEntitlementContext_1;
import product from '../../../../platform/product/common/product.js';
import { Barrier } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { asText, IRequestService } from '../../../../platform/request/common/request.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IAuthenticationExtensionsService, IAuthenticationService } from '../../authentication/common/authentication.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { URI } from '../../../../base/common/uri.js';
import Severity from '../../../../base/common/severity.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { isWeb } from '../../../../base/common/platform.js';
import { ILifecycleService } from '../../lifecycle/common/lifecycle.js';
import { distinct } from '../../../../base/common/arrays.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { observableFromEvent } from '../../../../base/common/observable.js';
export var ChatEntitlementContextKeys;
(function (ChatEntitlementContextKeys) {
    ChatEntitlementContextKeys.Setup = {
        hidden: new RawContextKey('chatSetupHidden', false, true), // True when chat setup is explicitly hidden.
        installed: new RawContextKey('chatSetupInstalled', false, true), // True when the chat extension is installed and enabled.
        disabled: new RawContextKey('chatSetupDisabled', false, true), // True when the chat extension is disabled due to any other reason than workspace trust.
        untrusted: new RawContextKey('chatSetupUntrusted', false, true), // True when the chat extension is disabled due to workspace trust.
        later: new RawContextKey('chatSetupLater', false, true), // True when the user wants to finish setup later.
        registered: new RawContextKey('chatSetupRegistered', false, true) // True when the user has registered as Free or Pro user.
    };
    ChatEntitlementContextKeys.Entitlement = {
        signedOut: new RawContextKey('chatEntitlementSignedOut', false, true), // True when user is signed out.
        canSignUp: new RawContextKey('chatPlanCanSignUp', false, true), // True when user can sign up to be a chat free user.
        planFree: new RawContextKey('chatPlanFree', false, true), // True when user is a chat free user.
        planPro: new RawContextKey('chatPlanPro', false, true), // True when user is a chat pro user.
        planProPlus: new RawContextKey('chatPlanProPlus', false, true), // True when user is a chat pro plus user.
        planBusiness: new RawContextKey('chatPlanBusiness', false, true), // True when user is a chat business user.
        planEnterprise: new RawContextKey('chatPlanEnterprise', false, true), // True when user is a chat enterprise user.
        organisations: new RawContextKey('chatEntitlementOrganisations', undefined, true), // The organizations the user belongs to.
        internal: new RawContextKey('chatEntitlementInternal', false, true), // True when user belongs to internal organisation.
        sku: new RawContextKey('chatEntitlementSku', undefined, true), // The SKU of the user.
    };
    ChatEntitlementContextKeys.chatQuotaExceeded = new RawContextKey('chatQuotaExceeded', false, true);
    ChatEntitlementContextKeys.completionsQuotaExceeded = new RawContextKey('completionsQuotaExceeded', false, true);
    ChatEntitlementContextKeys.chatAnonymous = new RawContextKey('chatAnonymous', false, true);
})(ChatEntitlementContextKeys || (ChatEntitlementContextKeys = {}));
export const IChatEntitlementService = createDecorator('chatEntitlementService');
export var ChatEntitlement;
(function (ChatEntitlement) {
    /** Signed out */
    ChatEntitlement[ChatEntitlement["Unknown"] = 1] = "Unknown";
    /** Signed in but not yet resolved */
    ChatEntitlement[ChatEntitlement["Unresolved"] = 2] = "Unresolved";
    /** Signed in and entitled to Free */
    ChatEntitlement[ChatEntitlement["Available"] = 3] = "Available";
    /** Signed in but not entitled to Free */
    ChatEntitlement[ChatEntitlement["Unavailable"] = 4] = "Unavailable";
    /** Signed-up to Free */
    ChatEntitlement[ChatEntitlement["Free"] = 5] = "Free";
    /** Signed-up to Pro */
    ChatEntitlement[ChatEntitlement["Pro"] = 6] = "Pro";
    /** Signed-up to Pro Plus */
    ChatEntitlement[ChatEntitlement["ProPlus"] = 7] = "ProPlus";
    /** Signed-up to Business */
    ChatEntitlement[ChatEntitlement["Business"] = 8] = "Business";
    /** Signed-up to Enterprise */
    ChatEntitlement[ChatEntitlement["Enterprise"] = 9] = "Enterprise";
})(ChatEntitlement || (ChatEntitlement = {}));
//#region Helper Functions
/**
 * Checks the chat entitlements to see if the user falls into the paid category
 * @param chatEntitlement The chat entitlement to check
 * @returns Whether or not they are a paid user
 */
export function isProUser(chatEntitlement) {
    return chatEntitlement === ChatEntitlement.Pro ||
        chatEntitlement === ChatEntitlement.ProPlus ||
        chatEntitlement === ChatEntitlement.Business ||
        chatEntitlement === ChatEntitlement.Enterprise;
}
//#region Service Implementation
const defaultChat = {
    extensionId: product.defaultChatAgent?.extensionId ?? '',
    chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? '',
    upgradePlanUrl: product.defaultChatAgent?.upgradePlanUrl ?? '',
    provider: product.defaultChatAgent?.provider ?? { default: { id: '' }, enterprise: { id: '' } },
    providerUriSetting: product.defaultChatAgent?.providerUriSetting ?? '',
    providerScopes: product.defaultChatAgent?.providerScopes ?? [[]],
    entitlementUrl: product.defaultChatAgent?.entitlementUrl ?? '',
    entitlementSignupLimitedUrl: product.defaultChatAgent?.entitlementSignupLimitedUrl ?? '',
    completionsAdvancedSetting: product.defaultChatAgent?.completionsAdvancedSetting ?? '',
    chatQuotaExceededContext: product.defaultChatAgent?.chatQuotaExceededContext ?? '',
    completionsQuotaExceededContext: product.defaultChatAgent?.completionsQuotaExceededContext ?? ''
};
const CHAT_ALLOW_ANONYMOUS_CONFIGURATION_KEY = 'chat.allowAnonymousAccess';
function isAnonymous(configurationService, entitlement, sentiment) {
    if (configurationService.getValue(CHAT_ALLOW_ANONYMOUS_CONFIGURATION_KEY) !== true) {
        return false; // only enabled behind an experimental setting
    }
    if (entitlement !== ChatEntitlement.Unknown) {
        return false; // only consider signed out users
    }
    if (sentiment.hidden || sentiment.disabled) {
        return false; // only consider enabled scenarios
    }
    return true;
}
function logChatEntitlements(state, configurationService, telemetryService) {
    telemetryService.publicLog2('chatEntitlements', {
        chatHidden: Boolean(state.hidden),
        chatDisabled: Boolean(state.disabled),
        chatEntitlement: state.entitlement,
        chatRegistered: Boolean(state.registered),
        chatAnonymous: isAnonymous(configurationService, state.entitlement, state)
    });
}
let ChatEntitlementService = class ChatEntitlementService extends Disposable {
    constructor(instantiationService, productService, environmentService, contextKeyService, configurationService, telemetryService, lifecycleService) {
        super();
        this.contextKeyService = contextKeyService;
        this.configurationService = configurationService;
        this.telemetryService = telemetryService;
        this.lifecycleService = lifecycleService;
        //#endregion
        //#region --- Quotas
        this._onDidChangeQuotaExceeded = this._register(new Emitter());
        this.onDidChangeQuotaExceeded = this._onDidChangeQuotaExceeded.event;
        this._onDidChangeQuotaRemaining = this._register(new Emitter());
        this.onDidChangeQuotaRemaining = this._onDidChangeQuotaRemaining.event;
        this._quotas = {};
        this.ExtensionQuotaContextKeys = {
            chatQuotaExceeded: defaultChat.chatQuotaExceededContext,
            completionsQuotaExceeded: defaultChat.completionsQuotaExceededContext,
        };
        this._onDidChangeAnonymous = this._register(new Emitter());
        this.onDidChangeAnonymous = this._onDidChangeAnonymous.event;
        this.anonymousObs = observableFromEvent(this.onDidChangeAnonymous, () => this.anonymous);
        this.chatQuotaExceededContextKey = ChatEntitlementContextKeys.chatQuotaExceeded.bindTo(this.contextKeyService);
        this.completionsQuotaExceededContextKey = ChatEntitlementContextKeys.completionsQuotaExceeded.bindTo(this.contextKeyService);
        this.anonymousContextKey = ChatEntitlementContextKeys.chatAnonymous.bindTo(this.contextKeyService);
        this.anonymousContextKey.set(this.anonymous);
        this.onDidChangeEntitlement = Event.map(Event.filter(this.contextKeyService.onDidChangeContext, e => e.affectsSome(new Set([
            ChatEntitlementContextKeys.Entitlement.planPro.key,
            ChatEntitlementContextKeys.Entitlement.planBusiness.key,
            ChatEntitlementContextKeys.Entitlement.planEnterprise.key,
            ChatEntitlementContextKeys.Entitlement.planProPlus.key,
            ChatEntitlementContextKeys.Entitlement.planFree.key,
            ChatEntitlementContextKeys.Entitlement.canSignUp.key,
            ChatEntitlementContextKeys.Entitlement.signedOut.key,
            ChatEntitlementContextKeys.Entitlement.organisations.key,
            ChatEntitlementContextKeys.Entitlement.internal.key,
            ChatEntitlementContextKeys.Entitlement.sku.key
        ])), this._store), () => { }, this._store);
        this.entitlementObs = observableFromEvent(this.onDidChangeEntitlement, () => this.entitlement);
        this.onDidChangeSentiment = Event.map(Event.filter(this.contextKeyService.onDidChangeContext, e => e.affectsSome(new Set([
            ChatEntitlementContextKeys.Setup.hidden.key,
            ChatEntitlementContextKeys.Setup.disabled.key,
            ChatEntitlementContextKeys.Setup.untrusted.key,
            ChatEntitlementContextKeys.Setup.installed.key,
            ChatEntitlementContextKeys.Setup.later.key,
            ChatEntitlementContextKeys.Setup.registered.key
        ])), this._store), () => { }, this._store);
        this.sentimentObs = observableFromEvent(this.onDidChangeSentiment, () => this.sentiment);
        if ((
        // TODO@bpasero remove this condition and 'serverlessWebEnabled' once Chat web support lands
        isWeb &&
            !environmentService.remoteAuthority &&
            !configurationService.getValue('chat.experimental.serverlessWebEnabled'))) {
            ChatEntitlementContextKeys.Setup.hidden.bindTo(this.contextKeyService).set(true); // hide copilot UI
            return;
        }
        if (!productService.defaultChatAgent) {
            return; // we need a default chat agent configured going forward from here
        }
        const context = this.context = new Lazy(() => this._register(instantiationService.createInstance(ChatEntitlementContext)));
        this.requests = new Lazy(() => this._register(instantiationService.createInstance(ChatEntitlementRequests, context.value, {
            clearQuotas: () => this.clearQuotas(),
            acceptQuotas: quotas => this.acceptQuotas(quotas)
        })));
        this.registerListeners();
    }
    get entitlement() {
        if (this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.planPro.key) === true) {
            return ChatEntitlement.Pro;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.planBusiness.key) === true) {
            return ChatEntitlement.Business;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.planEnterprise.key) === true) {
            return ChatEntitlement.Enterprise;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.planProPlus.key) === true) {
            return ChatEntitlement.ProPlus;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.planFree.key) === true) {
            return ChatEntitlement.Free;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.canSignUp.key) === true) {
            return ChatEntitlement.Available;
        }
        else if (this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.signedOut.key) === true) {
            return ChatEntitlement.Unknown;
        }
        return ChatEntitlement.Unresolved;
    }
    get isInternal() {
        return this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.internal.key) === true;
    }
    get organisations() {
        return this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.organisations.key);
    }
    get sku() {
        return this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Entitlement.sku.key);
    }
    get quotas() { return this._quotas; }
    registerListeners() {
        const quotaExceededSet = new Set([this.ExtensionQuotaContextKeys.chatQuotaExceeded, this.ExtensionQuotaContextKeys.completionsQuotaExceeded]);
        const cts = this._register(new MutableDisposable());
        this._register(this.contextKeyService.onDidChangeContext(e => {
            if (e.affectsSome(quotaExceededSet)) {
                if (cts.value) {
                    cts.value.cancel();
                }
                cts.value = new CancellationTokenSource();
                this.update(cts.value.token);
            }
        }));
        let anonymousUsage = this.anonymous;
        const updateAnonymousUsage = () => {
            const newAnonymousUsage = this.anonymous;
            if (newAnonymousUsage !== anonymousUsage) {
                anonymousUsage = newAnonymousUsage;
                this.anonymousContextKey.set(newAnonymousUsage);
                if (this.context?.hasValue) {
                    logChatEntitlements(this.context.value.state, this.configurationService, this.telemetryService);
                }
                this._onDidChangeAnonymous.fire();
            }
        };
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(CHAT_ALLOW_ANONYMOUS_CONFIGURATION_KEY)) {
                updateAnonymousUsage();
            }
        }));
        this._register(this.onDidChangeEntitlement(() => updateAnonymousUsage()));
        this._register(this.onDidChangeSentiment(() => updateAnonymousUsage()));
        // TODO@bpasero workaround for https://github.com/microsoft/vscode-internalbacklog/issues/6275
        this.lifecycleService.when(4 /* LifecyclePhase.Eventually */).then(() => {
            if (this.context?.hasValue) {
                logChatEntitlements(this.context.value.state, this.configurationService, this.telemetryService);
            }
        });
    }
    acceptQuotas(quotas) {
        const oldQuota = this._quotas;
        this._quotas = quotas;
        this.updateContextKeys();
        const { changed: chatChanged } = this.compareQuotas(oldQuota.chat, quotas.chat);
        const { changed: completionsChanged } = this.compareQuotas(oldQuota.completions, quotas.completions);
        const { changed: premiumChatChanged } = this.compareQuotas(oldQuota.premiumChat, quotas.premiumChat);
        if (chatChanged.exceeded || completionsChanged.exceeded || premiumChatChanged.exceeded) {
            this._onDidChangeQuotaExceeded.fire();
        }
        if (chatChanged.remaining || completionsChanged.remaining || premiumChatChanged.remaining) {
            this._onDidChangeQuotaRemaining.fire();
        }
    }
    compareQuotas(oldQuota, newQuota) {
        return {
            changed: {
                exceeded: (oldQuota?.percentRemaining === 0) !== (newQuota?.percentRemaining === 0),
                remaining: oldQuota?.percentRemaining !== newQuota?.percentRemaining
            }
        };
    }
    clearQuotas() {
        this.acceptQuotas({});
    }
    updateContextKeys() {
        this.chatQuotaExceededContextKey.set(this._quotas.chat?.percentRemaining === 0);
        this.completionsQuotaExceededContextKey.set(this._quotas.completions?.percentRemaining === 0);
    }
    get sentiment() {
        return {
            installed: this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Setup.installed.key) === true,
            hidden: this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Setup.hidden.key) === true,
            disabled: this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Setup.disabled.key) === true,
            untrusted: this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Setup.untrusted.key) === true,
            later: this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Setup.later.key) === true,
            registered: this.contextKeyService.getContextKeyValue(ChatEntitlementContextKeys.Setup.registered.key) === true
        };
    }
    get anonymous() {
        return isAnonymous(this.configurationService, this.entitlement, this.sentiment);
    }
    //#endregion
    async update(token) {
        await this.requests?.value.forceResolveEntitlement(undefined, token);
    }
};
ChatEntitlementService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IProductService),
    __param(2, IWorkbenchEnvironmentService),
    __param(3, IContextKeyService),
    __param(4, IConfigurationService),
    __param(5, ITelemetryService),
    __param(6, ILifecycleService)
], ChatEntitlementService);
export { ChatEntitlementService };
let ChatEntitlementRequests = ChatEntitlementRequests_1 = class ChatEntitlementRequests extends Disposable {
    static providerId(configurationService) {
        if (configurationService.getValue(`${defaultChat.completionsAdvancedSetting}.authProvider`) === defaultChat.provider.enterprise.id) {
            return defaultChat.provider.enterprise.id;
        }
        return defaultChat.provider.default.id;
    }
    constructor(context, chatQuotasAccessor, telemetryService, authenticationService, logService, requestService, dialogService, openerService, configurationService, authenticationExtensionsService, lifecycleService) {
        super();
        this.context = context;
        this.chatQuotasAccessor = chatQuotasAccessor;
        this.telemetryService = telemetryService;
        this.authenticationService = authenticationService;
        this.logService = logService;
        this.requestService = requestService;
        this.dialogService = dialogService;
        this.openerService = openerService;
        this.configurationService = configurationService;
        this.authenticationExtensionsService = authenticationExtensionsService;
        this.lifecycleService = lifecycleService;
        this.pendingResolveCts = new CancellationTokenSource();
        this.didResolveEntitlements = false;
        this.state = { entitlement: this.context.state.entitlement };
        this.registerListeners();
        this.resolve();
    }
    registerListeners() {
        this._register(this.authenticationService.onDidChangeDeclaredProviders(() => this.resolve()));
        this._register(this.authenticationService.onDidChangeSessions(e => {
            if (e.providerId === ChatEntitlementRequests_1.providerId(this.configurationService)) {
                this.resolve();
            }
        }));
        this._register(this.authenticationService.onDidRegisterAuthenticationProvider(e => {
            if (e.id === ChatEntitlementRequests_1.providerId(this.configurationService)) {
                this.resolve();
            }
        }));
        this._register(this.authenticationService.onDidUnregisterAuthenticationProvider(e => {
            if (e.id === ChatEntitlementRequests_1.providerId(this.configurationService)) {
                this.resolve();
            }
        }));
        this._register(this.context.onDidChange(() => {
            if (!this.context.state.installed || this.context.state.disabled || this.context.state.entitlement === ChatEntitlement.Unknown) {
                // When the extension is not installed, disabled or the user is not entitled
                // make sure to clear quotas so that any indicators are also gone
                this.state = { entitlement: this.state.entitlement, quotas: undefined };
                this.chatQuotasAccessor.clearQuotas();
            }
        }));
    }
    async resolve() {
        this.pendingResolveCts.dispose(true);
        const cts = this.pendingResolveCts = new CancellationTokenSource();
        const session = await this.findMatchingProviderSession(cts.token);
        if (cts.token.isCancellationRequested) {
            return;
        }
        // Immediately signal whether we have a session or not
        let state = undefined;
        if (session) {
            // Do not overwrite any state we have already
            if (this.state.entitlement === ChatEntitlement.Unknown) {
                state = { entitlement: ChatEntitlement.Unresolved };
            }
        }
        else {
            this.didResolveEntitlements = false; // reset so that we resolve entitlements fresh when signed in again
            state = { entitlement: ChatEntitlement.Unknown };
        }
        if (state) {
            this.update(state);
        }
        if (session && !this.didResolveEntitlements) {
            // Afterwards resolve entitlement with a network request
            // but only unless it was not already resolved before.
            await this.resolveEntitlement(session, cts.token);
        }
    }
    async findMatchingProviderSession(token) {
        const sessions = await this.doGetSessions(ChatEntitlementRequests_1.providerId(this.configurationService));
        if (token.isCancellationRequested) {
            return undefined;
        }
        const matchingSessions = new Set();
        for (const session of sessions) {
            for (const scopes of defaultChat.providerScopes) {
                if (this.includesScopes(session.scopes, scopes)) {
                    matchingSessions.add(session);
                }
            }
        }
        // We intentionally want to return an array of matching sessions and
        // not just the first, because it is possible that a matching session
        // has an expired token. As such, we want to try them all until we
        // succeeded with the request.
        return matchingSessions.size > 0 ? Array.from(matchingSessions) : undefined;
    }
    async doGetSessions(providerId) {
        const preferredAccountName = this.authenticationExtensionsService.getAccountPreference(defaultChat.chatExtensionId, providerId) ?? this.authenticationExtensionsService.getAccountPreference(defaultChat.extensionId, providerId);
        let preferredAccount;
        for (const account of await this.authenticationService.getAccounts(providerId)) {
            if (account.label === preferredAccountName) {
                preferredAccount = account;
                break;
            }
        }
        try {
            return await this.authenticationService.getSessions(providerId, undefined, { account: preferredAccount });
        }
        catch (error) {
            // ignore - errors can throw if a provider is not registered
        }
        return [];
    }
    includesScopes(scopes, expectedScopes) {
        return expectedScopes.every(scope => scopes.includes(scope));
    }
    async resolveEntitlement(sessions, token) {
        const entitlements = await this.doResolveEntitlement(sessions, token);
        if (typeof entitlements?.entitlement === 'number' && !token.isCancellationRequested) {
            this.didResolveEntitlements = true;
            this.update(entitlements);
        }
        return entitlements;
    }
    async doResolveEntitlement(sessions, token) {
        if (token.isCancellationRequested) {
            return undefined;
        }
        const response = await this.request(this.getEntitlementUrl(), 'GET', undefined, sessions, token);
        if (token.isCancellationRequested) {
            return undefined;
        }
        if (!response) {
            this.logService.trace('[chat entitlement]: no response');
            return { entitlement: ChatEntitlement.Unresolved };
        }
        if (response.res.statusCode && response.res.statusCode !== 200) {
            this.logService.trace(`[chat entitlement]: unexpected status code ${response.res.statusCode}`);
            return (response.res.statusCode === 401 || // oauth token being unavailable (expired/revoked)
                response.res.statusCode === 404 // missing scopes/permissions, service pretends the endpoint doesn't exist
            ) ? { entitlement: ChatEntitlement.Unknown /* treat as signed out */ } : { entitlement: ChatEntitlement.Unresolved };
        }
        let responseText = null;
        try {
            responseText = await asText(response);
        }
        catch (error) {
            // ignore - handled below
        }
        if (token.isCancellationRequested) {
            return undefined;
        }
        if (!responseText) {
            this.logService.trace('[chat entitlement]: response has no content');
            return { entitlement: ChatEntitlement.Unresolved };
        }
        let entitlementsResponse;
        try {
            entitlementsResponse = JSON.parse(responseText);
            this.logService.trace(`[chat entitlement]: parsed result is ${JSON.stringify(entitlementsResponse)}`);
        }
        catch (err) {
            this.logService.trace(`[chat entitlement]: error parsing response (${err})`);
            return { entitlement: ChatEntitlement.Unresolved };
        }
        let entitlement;
        if (entitlementsResponse.access_type_sku === 'free_limited_copilot') {
            entitlement = ChatEntitlement.Free;
        }
        else if (entitlementsResponse.can_signup_for_limited) {
            entitlement = ChatEntitlement.Available;
        }
        else if (entitlementsResponse.copilot_plan === 'individual') {
            entitlement = ChatEntitlement.Pro;
        }
        else if (entitlementsResponse.copilot_plan === 'individual_pro') {
            entitlement = ChatEntitlement.ProPlus;
        }
        else if (entitlementsResponse.copilot_plan === 'business') {
            entitlement = ChatEntitlement.Business;
        }
        else if (entitlementsResponse.copilot_plan === 'enterprise') {
            entitlement = ChatEntitlement.Enterprise;
        }
        else if (entitlementsResponse.chat_enabled) {
            // This should never happen as we exhaustively list the plans above. But if a new plan is added in the future older clients won't break
            entitlement = ChatEntitlement.Pro;
        }
        else {
            entitlement = ChatEntitlement.Unavailable;
        }
        const entitlements = {
            entitlement,
            organisations: entitlementsResponse.organization_login_list,
            quotas: this.toQuotas(entitlementsResponse),
            sku: entitlementsResponse.access_type_sku
        };
        this.logService.trace(`[chat entitlement]: resolved to ${entitlements.entitlement}, quotas: ${JSON.stringify(entitlements.quotas)}`);
        this.telemetryService.publicLog2('chatInstallEntitlement', {
            entitlement: entitlements.entitlement,
            tid: entitlementsResponse.analytics_tracking_id,
            sku: entitlements.sku,
            quotaChat: entitlements.quotas?.chat?.remaining,
            quotaPremiumChat: entitlements.quotas?.premiumChat?.remaining,
            quotaCompletions: entitlements.quotas?.completions?.remaining,
            quotaResetDate: entitlements.quotas?.resetDate
        });
        return entitlements;
    }
    getEntitlementUrl() {
        if (ChatEntitlementRequests_1.providerId(this.configurationService) === defaultChat.provider.enterprise.id) {
            try {
                const enterpriseUrl = new URL(this.configurationService.getValue(defaultChat.providerUriSetting));
                return `${enterpriseUrl.protocol}//api.${enterpriseUrl.hostname}${enterpriseUrl.port ? ':' + enterpriseUrl.port : ''}/copilot_internal/user`;
            }
            catch (error) {
                this.logService.error(error);
            }
        }
        return defaultChat.entitlementUrl;
    }
    toQuotas(response) {
        const quotas = {
            resetDate: response.quota_reset_date_utc ?? response.quota_reset_date ?? response.limited_user_reset_date,
            resetDateHasTime: typeof response.quota_reset_date_utc === 'string',
        };
        // Legacy Free SKU Quota
        if (response.monthly_quotas?.chat && typeof response.limited_user_quotas?.chat === 'number') {
            quotas.chat = {
                total: response.monthly_quotas.chat,
                remaining: response.limited_user_quotas.chat,
                percentRemaining: Math.min(100, Math.max(0, (response.limited_user_quotas.chat / response.monthly_quotas.chat) * 100)),
                overageEnabled: false,
                overageCount: 0,
                unlimited: false
            };
        }
        if (response.monthly_quotas?.completions && typeof response.limited_user_quotas?.completions === 'number') {
            quotas.completions = {
                total: response.monthly_quotas.completions,
                remaining: response.limited_user_quotas.completions,
                percentRemaining: Math.min(100, Math.max(0, (response.limited_user_quotas.completions / response.monthly_quotas.completions) * 100)),
                overageEnabled: false,
                overageCount: 0,
                unlimited: false
            };
        }
        // New Quota Snapshot
        if (response.quota_snapshots) {
            for (const quotaType of ['chat', 'completions', 'premium_interactions']) {
                const rawQuotaSnapshot = response.quota_snapshots[quotaType];
                if (!rawQuotaSnapshot) {
                    continue;
                }
                const quotaSnapshot = {
                    total: rawQuotaSnapshot.entitlement,
                    remaining: rawQuotaSnapshot.remaining,
                    percentRemaining: Math.min(100, Math.max(0, rawQuotaSnapshot.percent_remaining)),
                    overageEnabled: rawQuotaSnapshot.overage_permitted,
                    overageCount: rawQuotaSnapshot.overage_count,
                    unlimited: rawQuotaSnapshot.unlimited
                };
                switch (quotaType) {
                    case 'chat':
                        quotas.chat = quotaSnapshot;
                        break;
                    case 'completions':
                        quotas.completions = quotaSnapshot;
                        break;
                    case 'premium_interactions':
                        quotas.premiumChat = quotaSnapshot;
                        break;
                }
            }
        }
        return quotas;
    }
    async request(url, type, body, sessions, token) {
        let lastRequest;
        for (const session of sessions) {
            if (token.isCancellationRequested) {
                return lastRequest;
            }
            try {
                const response = await this.requestService.request({
                    type,
                    url,
                    data: type === 'POST' ? JSON.stringify(body) : undefined,
                    disableCache: true,
                    headers: {
                        'Authorization': `Bearer ${session.accessToken}`
                    }
                }, token);
                const status = response.res.statusCode;
                if (status && status !== 200) {
                    lastRequest = response;
                    continue; // try next session
                }
                return response;
            }
            catch (error) {
                if (!token.isCancellationRequested) {
                    this.logService.error(`[chat entitlement] request: error ${error}`);
                }
            }
        }
        return lastRequest;
    }
    update(state) {
        this.state = state;
        this.context.update({ entitlement: this.state.entitlement, organisations: this.state.organisations, sku: this.state.sku });
        if (state.quotas) {
            this.chatQuotasAccessor.acceptQuotas(state.quotas);
        }
    }
    async forceResolveEntitlement(sessions, token = CancellationToken.None) {
        if (!sessions) {
            sessions = await this.findMatchingProviderSession(token);
        }
        if (!sessions || sessions.length === 0) {
            return undefined;
        }
        return this.resolveEntitlement(sessions, token);
    }
    async signUpFree(sessions) {
        const body = {
            restricted_telemetry: this.telemetryService.telemetryLevel === 0 /* TelemetryLevel.NONE */ ? 'disabled' : 'enabled',
            public_code_suggestions: 'enabled'
        };
        const response = await this.request(defaultChat.entitlementSignupLimitedUrl, 'POST', body, sessions, CancellationToken.None);
        if (!response) {
            const retry = await this.onUnknownSignUpError(localize('signUpNoResponseError', "No response received."), '[chat entitlement] sign-up: no response');
            return retry ? this.signUpFree(sessions) : { errorCode: 1 };
        }
        if (response.res.statusCode && response.res.statusCode !== 200) {
            if (response.res.statusCode === 422) {
                try {
                    const responseText = await asText(response);
                    if (responseText) {
                        const responseError = JSON.parse(responseText);
                        if (typeof responseError.message === 'string' && responseError.message) {
                            this.onUnprocessableSignUpError(`[chat entitlement] sign-up: unprocessable entity (${responseError.message})`, responseError.message);
                            return { errorCode: response.res.statusCode };
                        }
                    }
                }
                catch (error) {
                    // ignore - handled below
                }
            }
            const retry = await this.onUnknownSignUpError(localize('signUpUnexpectedStatusError', "Unexpected status code {0}.", response.res.statusCode), `[chat entitlement] sign-up: unexpected status code ${response.res.statusCode}`);
            return retry ? this.signUpFree(sessions) : { errorCode: response.res.statusCode };
        }
        let responseText = null;
        try {
            responseText = await asText(response);
        }
        catch (error) {
            // ignore - handled below
        }
        if (!responseText) {
            const retry = await this.onUnknownSignUpError(localize('signUpNoResponseContentsError', "Response has no contents."), '[chat entitlement] sign-up: response has no content');
            return retry ? this.signUpFree(sessions) : { errorCode: 2 };
        }
        let parsedResult = undefined;
        try {
            parsedResult = JSON.parse(responseText);
            this.logService.trace(`[chat entitlement] sign-up: response is ${responseText}`);
        }
        catch (err) {
            const retry = await this.onUnknownSignUpError(localize('signUpInvalidResponseError', "Invalid response contents."), `[chat entitlement] sign-up: error parsing response (${err})`);
            return retry ? this.signUpFree(sessions) : { errorCode: 3 };
        }
        // We have made it this far, so the user either did sign-up or was signed-up already.
        // That is, because the endpoint throws in all other case according to Patrick.
        this.update({ entitlement: ChatEntitlement.Free });
        return Boolean(parsedResult?.subscribed);
    }
    async onUnknownSignUpError(detail, logMessage) {
        this.logService.error(logMessage);
        if (!this.lifecycleService.willShutdown) {
            const { confirmed } = await this.dialogService.confirm({
                type: Severity.Error,
                message: localize('unknownSignUpError', "An error occurred while signing up for the GitHub Copilot Free plan. Would you like to try again?"),
                detail,
                primaryButton: localize('retry', "Retry")
            });
            return confirmed;
        }
        return false;
    }
    onUnprocessableSignUpError(logMessage, logDetails) {
        this.logService.error(logMessage);
        if (!this.lifecycleService.willShutdown) {
            this.dialogService.prompt({
                type: Severity.Error,
                message: localize('unprocessableSignUpError', "An error occurred while signing up for the GitHub Copilot Free plan."),
                detail: logDetails,
                buttons: [
                    {
                        label: localize('ok', "OK"),
                        run: () => { }
                    },
                    {
                        label: localize('learnMore', "Learn More"),
                        run: () => this.openerService.open(URI.parse(defaultChat.upgradePlanUrl))
                    }
                ]
            });
        }
    }
    async signIn(options) {
        const providerId = ChatEntitlementRequests_1.providerId(this.configurationService);
        let defaultProviderScopes;
        if (this.configurationService.getValue('chat.signInWithAlternateScopes') === true) {
            defaultProviderScopes = defaultChat.providerScopes.at(-1) ?? [];
        }
        else {
            defaultProviderScopes = defaultChat.providerScopes.at(0) ?? [];
        }
        const scopes = options?.additionalScopes ? distinct([...defaultProviderScopes, ...options.additionalScopes]) : defaultProviderScopes;
        const session = await this.authenticationService.createSession(providerId, scopes, {
            extraAuthorizeParameters: { get_started_with: 'copilot-vscode' },
            provider: options?.useSocialProvider
        });
        this.authenticationExtensionsService.updateAccountPreference(defaultChat.extensionId, providerId, session.account);
        this.authenticationExtensionsService.updateAccountPreference(defaultChat.chatExtensionId, providerId, session.account);
        const entitlements = await this.forceResolveEntitlement([session]);
        return { session, entitlements };
    }
    dispose() {
        this.pendingResolveCts.dispose(true);
        super.dispose();
    }
};
ChatEntitlementRequests = ChatEntitlementRequests_1 = __decorate([
    __param(2, ITelemetryService),
    __param(3, IAuthenticationService),
    __param(4, ILogService),
    __param(5, IRequestService),
    __param(6, IDialogService),
    __param(7, IOpenerService),
    __param(8, IConfigurationService),
    __param(9, IAuthenticationExtensionsService),
    __param(10, ILifecycleService)
], ChatEntitlementRequests);
export { ChatEntitlementRequests };
let ChatEntitlementContext = class ChatEntitlementContext extends Disposable {
    static { ChatEntitlementContext_1 = this; }
    static { this.CHAT_ENTITLEMENT_CONTEXT_STORAGE_KEY = 'chat.setupContext'; }
    static { this.CHAT_DISABLED_CONFIGURATION_KEY = 'chat.disableAIFeatures'; }
    get state() { return this.withConfiguration(this.suspendedState ?? this._state); }
    constructor(contextKeyService, storageService, logService, configurationService, telemetryService) {
        super();
        this.storageService = storageService;
        this.logService = logService;
        this.configurationService = configurationService;
        this.telemetryService = telemetryService;
        this.suspendedState = undefined;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.updateBarrier = undefined;
        this.canSignUpContextKey = ChatEntitlementContextKeys.Entitlement.canSignUp.bindTo(contextKeyService);
        this.signedOutContextKey = ChatEntitlementContextKeys.Entitlement.signedOut.bindTo(contextKeyService);
        this.freeContextKey = ChatEntitlementContextKeys.Entitlement.planFree.bindTo(contextKeyService);
        this.proContextKey = ChatEntitlementContextKeys.Entitlement.planPro.bindTo(contextKeyService);
        this.proPlusContextKey = ChatEntitlementContextKeys.Entitlement.planProPlus.bindTo(contextKeyService);
        this.businessContextKey = ChatEntitlementContextKeys.Entitlement.planBusiness.bindTo(contextKeyService);
        this.enterpriseContextKey = ChatEntitlementContextKeys.Entitlement.planEnterprise.bindTo(contextKeyService);
        this.organisationsContextKey = ChatEntitlementContextKeys.Entitlement.organisations.bindTo(contextKeyService);
        this.isInternalContextKey = ChatEntitlementContextKeys.Entitlement.internal.bindTo(contextKeyService);
        this.skuContextKey = ChatEntitlementContextKeys.Entitlement.sku.bindTo(contextKeyService);
        this.hiddenContext = ChatEntitlementContextKeys.Setup.hidden.bindTo(contextKeyService);
        this.laterContext = ChatEntitlementContextKeys.Setup.later.bindTo(contextKeyService);
        this.installedContext = ChatEntitlementContextKeys.Setup.installed.bindTo(contextKeyService);
        this.disabledContext = ChatEntitlementContextKeys.Setup.disabled.bindTo(contextKeyService);
        this.untrustedContext = ChatEntitlementContextKeys.Setup.untrusted.bindTo(contextKeyService);
        this.registeredContext = ChatEntitlementContextKeys.Setup.registered.bindTo(contextKeyService);
        this._state = this.storageService.getObject(ChatEntitlementContext_1.CHAT_ENTITLEMENT_CONTEXT_STORAGE_KEY, 0 /* StorageScope.PROFILE */) ?? { entitlement: ChatEntitlement.Unknown, organisations: undefined, sku: undefined };
        this.updateContextSync();
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ChatEntitlementContext_1.CHAT_DISABLED_CONFIGURATION_KEY)) {
                this.updateContext();
            }
        }));
    }
    withConfiguration(state) {
        if (this.configurationService.getValue(ChatEntitlementContext_1.CHAT_DISABLED_CONFIGURATION_KEY) === true) {
            return {
                ...state,
                hidden: true // Setting always wins: if AI is disabled, set `hidden: true`
            };
        }
        return state;
    }
    async update(context) {
        this.logService.trace(`[chat entitlement context] update(): ${JSON.stringify(context)}`);
        const oldState = JSON.stringify(this._state);
        if (typeof context.installed === 'boolean' && typeof context.disabled === 'boolean' && typeof context.untrusted === 'boolean') {
            this._state.installed = context.installed;
            this._state.disabled = context.disabled;
            this._state.untrusted = context.untrusted;
            if (context.installed && !context.disabled) {
                context.hidden = false; // treat this as a sign to make Chat visible again in case it is hidden
            }
        }
        if (typeof context.hidden === 'boolean') {
            this._state.hidden = context.hidden;
        }
        if (typeof context.later === 'boolean') {
            this._state.later = context.later;
        }
        if (typeof context.entitlement === 'number') {
            this._state.entitlement = context.entitlement;
            this._state.organisations = context.organisations;
            this._state.sku = context.sku;
            if (this._state.entitlement === ChatEntitlement.Free || isProUser(this._state.entitlement)) {
                this._state.registered = true;
            }
            else if (this._state.entitlement === ChatEntitlement.Available) {
                this._state.registered = false; // only reset when signed-in user can sign-up for free
            }
        }
        if (oldState === JSON.stringify(this._state)) {
            return; // state did not change
        }
        this.storageService.store(ChatEntitlementContext_1.CHAT_ENTITLEMENT_CONTEXT_STORAGE_KEY, {
            ...this._state,
            later: undefined // do not persist this across restarts for now
        }, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        return this.updateContext();
    }
    async updateContext() {
        await this.updateBarrier?.wait();
        this.updateContextSync();
    }
    updateContextSync() {
        const state = this.withConfiguration(this._state);
        this.signedOutContextKey.set(state.entitlement === ChatEntitlement.Unknown);
        this.canSignUpContextKey.set(state.entitlement === ChatEntitlement.Available);
        this.freeContextKey.set(state.entitlement === ChatEntitlement.Free);
        this.proContextKey.set(state.entitlement === ChatEntitlement.Pro);
        this.proPlusContextKey.set(state.entitlement === ChatEntitlement.ProPlus);
        this.businessContextKey.set(state.entitlement === ChatEntitlement.Business);
        this.enterpriseContextKey.set(state.entitlement === ChatEntitlement.Enterprise);
        this.organisationsContextKey.set(state.organisations);
        this.isInternalContextKey.set(Boolean(state.organisations?.some(org => org === 'github' || org === 'microsoft' || org === 'ms-copilot' || org === 'MicrosoftCopilot')));
        this.skuContextKey.set(state.sku);
        this.hiddenContext.set(!!state.hidden);
        this.laterContext.set(!!state.later);
        this.installedContext.set(!!state.installed);
        this.disabledContext.set(!!state.disabled);
        this.untrustedContext.set(!!state.untrusted);
        this.registeredContext.set(!!state.registered);
        this.logService.trace(`[chat entitlement context] updateContext(): ${JSON.stringify(state)}`);
        logChatEntitlements(state, this.configurationService, this.telemetryService);
        this._onDidChange.fire();
    }
    suspend() {
        this.suspendedState = { ...this._state };
        this.updateBarrier = new Barrier();
    }
    resume() {
        this.suspendedState = undefined;
        this.updateBarrier?.open();
        this.updateBarrier = undefined;
    }
};
ChatEntitlementContext = ChatEntitlementContext_1 = __decorate([
    __param(0, IContextKeyService),
    __param(1, IStorageService),
    __param(2, ILogService),
    __param(3, IConfigurationService),
    __param(4, ITelemetryService)
], ChatEntitlementContext);
export { ChatEntitlementContext };
//#endregion
registerSingleton(IChatEntitlementService, ChatEntitlementService, 0 /* InstantiationType.Eager */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVudGl0bGVtZW50U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvY2hhdC9jb21tb24vY2hhdEVudGl0bGVtZW50U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxPQUFPLE1BQU0sZ0RBQWdELENBQUM7QUFDckUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVyRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFlLGtCQUFrQixFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsZUFBZSxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDcEgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxlQUFl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