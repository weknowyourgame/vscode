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
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAuthenticationService, IAuthenticationExtensionsService, INTERNAL_AUTH_PROVIDER_PREFIX } from '../common/authentication.js';
import { IAuthenticationQueryService } from '../common/authenticationQuery.js';
import { IAuthenticationUsageService } from './authenticationUsageService.js';
import { IAuthenticationMcpUsageService } from './authenticationMcpUsageService.js';
import { IAuthenticationAccessService } from './authenticationAccessService.js';
import { IAuthenticationMcpAccessService } from './authenticationMcpAccessService.js';
import { IAuthenticationMcpService } from './authenticationMcpService.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
/**
 * Base implementation for query interfaces
 */
class BaseQuery {
    constructor(providerId, queryService) {
        this.providerId = providerId;
        this.queryService = queryService;
    }
}
/**
 * Implementation of account-extension query operations
 */
class AccountExtensionQuery extends BaseQuery {
    constructor(providerId, accountName, extensionId, queryService) {
        super(providerId, queryService);
        this.accountName = accountName;
        this.extensionId = extensionId;
    }
    isAccessAllowed() {
        return this.queryService.authenticationAccessService.isAccessAllowed(this.providerId, this.accountName, this.extensionId);
    }
    setAccessAllowed(allowed, extensionName) {
        this.queryService.authenticationAccessService.updateAllowedExtensions(this.providerId, this.accountName, [{ id: this.extensionId, name: extensionName || this.extensionId, allowed }]);
    }
    addUsage(scopes, extensionName) {
        this.queryService.authenticationUsageService.addAccountUsage(this.providerId, this.accountName, scopes, this.extensionId, extensionName);
    }
    getUsage() {
        const allUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
        return allUsages
            .filter(usage => usage.extensionId === ExtensionIdentifier.toKey(this.extensionId))
            .map(usage => ({
            extensionId: usage.extensionId,
            extensionName: usage.extensionName,
            scopes: usage.scopes || [],
            lastUsed: usage.lastUsed
        }));
    }
    removeUsage() {
        // Get current usages, filter out this extension, and store the rest
        const allUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
        const filteredUsages = allUsages.filter(usage => usage.extensionId !== this.extensionId);
        // Clear all usages and re-add the filtered ones
        this.queryService.authenticationUsageService.removeAccountUsage(this.providerId, this.accountName);
        for (const usage of filteredUsages) {
            this.queryService.authenticationUsageService.addAccountUsage(this.providerId, this.accountName, usage.scopes || [], usage.extensionId, usage.extensionName);
        }
    }
    setAsPreferred() {
        this.queryService.authenticationExtensionsService.updateAccountPreference(this.extensionId, this.providerId, { label: this.accountName, id: this.accountName });
    }
    isPreferred() {
        const preferredAccount = this.queryService.authenticationExtensionsService.getAccountPreference(this.extensionId, this.providerId);
        return preferredAccount === this.accountName;
    }
    isTrusted() {
        const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName);
        const extension = allowedExtensions.find(ext => ext.id === this.extensionId);
        return extension?.trusted === true;
    }
}
/**
 * Implementation of account-MCP server query operations
 */
class AccountMcpServerQuery extends BaseQuery {
    constructor(providerId, accountName, mcpServerId, queryService) {
        super(providerId, queryService);
        this.accountName = accountName;
        this.mcpServerId = mcpServerId;
    }
    isAccessAllowed() {
        return this.queryService.authenticationMcpAccessService.isAccessAllowed(this.providerId, this.accountName, this.mcpServerId);
    }
    setAccessAllowed(allowed, mcpServerName) {
        this.queryService.authenticationMcpAccessService.updateAllowedMcpServers(this.providerId, this.accountName, [{ id: this.mcpServerId, name: mcpServerName || this.mcpServerId, allowed }]);
    }
    addUsage(scopes, mcpServerName) {
        this.queryService.authenticationMcpUsageService.addAccountUsage(this.providerId, this.accountName, scopes, this.mcpServerId, mcpServerName);
    }
    getUsage() {
        const allUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
        return allUsages
            .filter(usage => usage.mcpServerId === this.mcpServerId)
            .map(usage => ({
            mcpServerId: usage.mcpServerId,
            mcpServerName: usage.mcpServerName,
            scopes: usage.scopes || [],
            lastUsed: usage.lastUsed
        }));
    }
    removeUsage() {
        // Get current usages, filter out this MCP server, and store the rest
        const allUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
        const filteredUsages = allUsages.filter(usage => usage.mcpServerId !== this.mcpServerId);
        // Clear all usages and re-add the filtered ones
        this.queryService.authenticationMcpUsageService.removeAccountUsage(this.providerId, this.accountName);
        for (const usage of filteredUsages) {
            this.queryService.authenticationMcpUsageService.addAccountUsage(this.providerId, this.accountName, usage.scopes || [], usage.mcpServerId, usage.mcpServerName);
        }
    }
    setAsPreferred() {
        this.queryService.authenticationMcpService.updateAccountPreference(this.mcpServerId, this.providerId, { label: this.accountName, id: this.accountName });
    }
    isPreferred() {
        const preferredAccount = this.queryService.authenticationMcpService.getAccountPreference(this.mcpServerId, this.providerId);
        return preferredAccount === this.accountName;
    }
    isTrusted() {
        const allowedMcpServers = this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName);
        const mcpServer = allowedMcpServers.find(server => server.id === this.mcpServerId);
        return mcpServer?.trusted === true;
    }
}
/**
 * Implementation of account-extensions query operations
 */
class AccountExtensionsQuery extends BaseQuery {
    constructor(providerId, accountName, queryService) {
        super(providerId, queryService);
        this.accountName = accountName;
    }
    getAllowedExtensions() {
        const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName);
        const usages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
        return allowedExtensions
            .filter(ext => ext.allowed !== false)
            .map(ext => {
            // Find the most recent usage for this extension
            const extensionUsages = usages.filter(usage => usage.extensionId === ext.id);
            const lastUsed = extensionUsages.length > 0 ? Math.max(...extensionUsages.map(u => u.lastUsed)) : undefined;
            // Check if trusted through the extension query
            const extensionQuery = new AccountExtensionQuery(this.providerId, this.accountName, ext.id, this.queryService);
            const trusted = extensionQuery.isTrusted();
            return {
                id: ext.id,
                name: ext.name,
                allowed: ext.allowed,
                lastUsed,
                trusted
            };
        });
    }
    allowAccess(extensionIds) {
        const extensionsToAllow = extensionIds.map(id => ({ id, name: id, allowed: true }));
        this.queryService.authenticationAccessService.updateAllowedExtensions(this.providerId, this.accountName, extensionsToAllow);
    }
    removeAccess(extensionIds) {
        const extensionsToRemove = extensionIds.map(id => ({ id, name: id, allowed: false }));
        this.queryService.authenticationAccessService.updateAllowedExtensions(this.providerId, this.accountName, extensionsToRemove);
    }
    forEach(callback) {
        const usages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
        const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName);
        // Combine extensions from both usage and access data
        const extensionIds = new Set();
        usages.forEach(usage => extensionIds.add(usage.extensionId));
        allowedExtensions.forEach(ext => extensionIds.add(ext.id));
        for (const extensionId of extensionIds) {
            const extensionQuery = new AccountExtensionQuery(this.providerId, this.accountName, extensionId, this.queryService);
            callback(extensionQuery);
        }
    }
}
/**
 * Implementation of account-MCP servers query operations
 */
class AccountMcpServersQuery extends BaseQuery {
    constructor(providerId, accountName, queryService) {
        super(providerId, queryService);
        this.accountName = accountName;
    }
    getAllowedMcpServers() {
        return this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName)
            .filter(server => server.allowed !== false);
    }
    allowAccess(mcpServerIds) {
        const mcpServersToAllow = mcpServerIds.map(id => ({ id, name: id, allowed: true }));
        this.queryService.authenticationMcpAccessService.updateAllowedMcpServers(this.providerId, this.accountName, mcpServersToAllow);
    }
    removeAccess(mcpServerIds) {
        const mcpServersToRemove = mcpServerIds.map(id => ({ id, name: id, allowed: false }));
        this.queryService.authenticationMcpAccessService.updateAllowedMcpServers(this.providerId, this.accountName, mcpServersToRemove);
    }
    forEach(callback) {
        const usages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
        const allowedMcpServers = this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName);
        // Combine MCP servers from both usage and access data
        const mcpServerIds = new Set();
        usages.forEach(usage => mcpServerIds.add(usage.mcpServerId));
        allowedMcpServers.forEach(server => mcpServerIds.add(server.id));
        for (const mcpServerId of mcpServerIds) {
            const mcpServerQuery = new AccountMcpServerQuery(this.providerId, this.accountName, mcpServerId, this.queryService);
            callback(mcpServerQuery);
        }
    }
}
/**
 * Implementation of account-entities query operations for type-agnostic operations
 */
class AccountEntitiesQuery extends BaseQuery {
    constructor(providerId, accountName, queryService) {
        super(providerId, queryService);
        this.accountName = accountName;
    }
    hasAnyUsage() {
        // Check extension usage
        const extensionUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
        if (extensionUsages.length > 0) {
            return true;
        }
        // Check MCP server usage
        const mcpUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
        if (mcpUsages.length > 0) {
            return true;
        }
        // Check extension access
        const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName);
        if (allowedExtensions.some(ext => ext.allowed !== false)) {
            return true;
        }
        // Check MCP server access
        const allowedMcpServers = this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName);
        if (allowedMcpServers.some(server => server.allowed !== false)) {
            return true;
        }
        return false;
    }
    getEntityCount() {
        // Use the same logic as getAllEntities to count all entities with usage or access
        const extensionUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, this.accountName);
        const allowedExtensions = this.queryService.authenticationAccessService.readAllowedExtensions(this.providerId, this.accountName).filter(ext => ext.allowed);
        const extensionIds = new Set();
        extensionUsages.forEach(usage => extensionIds.add(usage.extensionId));
        allowedExtensions.forEach(ext => extensionIds.add(ext.id));
        const mcpUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, this.accountName);
        const allowedMcpServers = this.queryService.authenticationMcpAccessService.readAllowedMcpServers(this.providerId, this.accountName).filter(server => server.allowed);
        const mcpServerIds = new Set();
        mcpUsages.forEach(usage => mcpServerIds.add(usage.mcpServerId));
        allowedMcpServers.forEach(server => mcpServerIds.add(server.id));
        const extensionCount = extensionIds.size;
        const mcpServerCount = mcpServerIds.size;
        return {
            extensions: extensionCount,
            mcpServers: mcpServerCount,
            total: extensionCount + mcpServerCount
        };
    }
    removeAllAccess() {
        // Remove all extension access
        const extensionsQuery = new AccountExtensionsQuery(this.providerId, this.accountName, this.queryService);
        const extensions = extensionsQuery.getAllowedExtensions();
        const extensionIds = extensions.map(ext => ext.id);
        if (extensionIds.length > 0) {
            extensionsQuery.removeAccess(extensionIds);
        }
        // Remove all MCP server access
        const mcpServersQuery = new AccountMcpServersQuery(this.providerId, this.accountName, this.queryService);
        const mcpServers = mcpServersQuery.getAllowedMcpServers();
        const mcpServerIds = mcpServers.map(server => server.id);
        if (mcpServerIds.length > 0) {
            mcpServersQuery.removeAccess(mcpServerIds);
        }
    }
    forEach(callback) {
        // Iterate over extensions
        const extensionsQuery = new AccountExtensionsQuery(this.providerId, this.accountName, this.queryService);
        extensionsQuery.forEach(extensionQuery => {
            callback(extensionQuery.extensionId, 'extension');
        });
        // Iterate over MCP servers
        const mcpServersQuery = new AccountMcpServersQuery(this.providerId, this.accountName, this.queryService);
        mcpServersQuery.forEach(mcpServerQuery => {
            callback(mcpServerQuery.mcpServerId, 'mcpServer');
        });
    }
}
/**
 * Implementation of account query operations
 */
class AccountQuery extends BaseQuery {
    constructor(providerId, accountName, queryService) {
        super(providerId, queryService);
        this.accountName = accountName;
    }
    extension(extensionId) {
        return new AccountExtensionQuery(this.providerId, this.accountName, extensionId, this.queryService);
    }
    mcpServer(mcpServerId) {
        return new AccountMcpServerQuery(this.providerId, this.accountName, mcpServerId, this.queryService);
    }
    extensions() {
        return new AccountExtensionsQuery(this.providerId, this.accountName, this.queryService);
    }
    mcpServers() {
        return new AccountMcpServersQuery(this.providerId, this.accountName, this.queryService);
    }
    entities() {
        return new AccountEntitiesQuery(this.providerId, this.accountName, this.queryService);
    }
    remove() {
        // Remove all extension access and usage data
        this.queryService.authenticationAccessService.removeAllowedExtensions(this.providerId, this.accountName);
        this.queryService.authenticationUsageService.removeAccountUsage(this.providerId, this.accountName);
        // Remove all MCP server access and usage data
        this.queryService.authenticationMcpAccessService.removeAllowedMcpServers(this.providerId, this.accountName);
        this.queryService.authenticationMcpUsageService.removeAccountUsage(this.providerId, this.accountName);
    }
}
/**
 * Implementation of provider-extension query operations
 */
class ProviderExtensionQuery extends BaseQuery {
    constructor(providerId, extensionId, queryService) {
        super(providerId, queryService);
        this.extensionId = extensionId;
    }
    getPreferredAccount() {
        return this.queryService.authenticationExtensionsService.getAccountPreference(this.extensionId, this.providerId);
    }
    setPreferredAccount(account) {
        this.queryService.authenticationExtensionsService.updateAccountPreference(this.extensionId, this.providerId, account);
    }
    removeAccountPreference() {
        this.queryService.authenticationExtensionsService.removeAccountPreference(this.extensionId, this.providerId);
    }
}
/**
 * Implementation of provider-MCP server query operations
 */
class ProviderMcpServerQuery extends BaseQuery {
    constructor(providerId, mcpServerId, queryService) {
        super(providerId, queryService);
        this.mcpServerId = mcpServerId;
    }
    async getLastUsedAccount() {
        try {
            const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
            let lastUsedAccount;
            let lastUsedTime = 0;
            for (const account of accounts) {
                const usages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, account.label);
                const mcpServerUsages = usages.filter(usage => usage.mcpServerId === this.mcpServerId);
                for (const usage of mcpServerUsages) {
                    if (usage.lastUsed > lastUsedTime) {
                        lastUsedTime = usage.lastUsed;
                        lastUsedAccount = account.label;
                    }
                }
            }
            return lastUsedAccount;
        }
        catch {
            return undefined;
        }
    }
    getPreferredAccount() {
        return this.queryService.authenticationMcpService.getAccountPreference(this.mcpServerId, this.providerId);
    }
    setPreferredAccount(account) {
        this.queryService.authenticationMcpService.updateAccountPreference(this.mcpServerId, this.providerId, account);
    }
    removeAccountPreference() {
        this.queryService.authenticationMcpService.removeAccountPreference(this.mcpServerId, this.providerId);
    }
    async getUsedAccounts() {
        try {
            const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
            const usedAccounts = [];
            for (const account of accounts) {
                const usages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, account.label);
                if (usages.some(usage => usage.mcpServerId === this.mcpServerId)) {
                    usedAccounts.push(account.label);
                }
            }
            return usedAccounts;
        }
        catch {
            return [];
        }
    }
}
/**
 * Implementation of provider query operations
 */
class ProviderQuery extends BaseQuery {
    constructor(providerId, queryService) {
        super(providerId, queryService);
    }
    account(accountName) {
        return new AccountQuery(this.providerId, accountName, this.queryService);
    }
    extension(extensionId) {
        return new ProviderExtensionQuery(this.providerId, extensionId, this.queryService);
    }
    mcpServer(mcpServerId) {
        return new ProviderMcpServerQuery(this.providerId, mcpServerId, this.queryService);
    }
    async getActiveEntities() {
        const extensions = [];
        const mcpServers = [];
        try {
            const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
            for (const account of accounts) {
                // Get extension usages
                const extensionUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, account.label);
                for (const usage of extensionUsages) {
                    if (!extensions.includes(usage.extensionId)) {
                        extensions.push(usage.extensionId);
                    }
                }
                // Get MCP server usages
                const mcpUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, account.label);
                for (const usage of mcpUsages) {
                    if (!mcpServers.includes(usage.mcpServerId)) {
                        mcpServers.push(usage.mcpServerId);
                    }
                }
            }
        }
        catch {
            // Return empty arrays if there's an error
        }
        return { extensions, mcpServers };
    }
    async getAccountNames() {
        try {
            const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
            return accounts.map(account => account.label);
        }
        catch {
            return [];
        }
    }
    async getUsageStats() {
        const recentActivity = [];
        let totalSessions = 0;
        let totalAccounts = 0;
        try {
            const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
            totalAccounts = accounts.length;
            for (const account of accounts) {
                const extensionUsages = this.queryService.authenticationUsageService.readAccountUsages(this.providerId, account.label);
                const mcpUsages = this.queryService.authenticationMcpUsageService.readAccountUsages(this.providerId, account.label);
                const allUsages = [...extensionUsages, ...mcpUsages];
                const usageCount = allUsages.length;
                const lastUsed = Math.max(...allUsages.map(u => u.lastUsed), 0);
                if (usageCount > 0) {
                    recentActivity.push({ accountName: account.label, lastUsed, usageCount });
                }
            }
            // Sort by most recent activity
            recentActivity.sort((a, b) => b.lastUsed - a.lastUsed);
            // Count total sessions (approximate)
            totalSessions = recentActivity.reduce((sum, activity) => sum + activity.usageCount, 0);
        }
        catch {
            // Return default stats if there's an error
        }
        return { totalSessions, totalAccounts, recentActivity };
    }
    async forEachAccount(callback) {
        try {
            const accounts = await this.queryService.authenticationService.getAccounts(this.providerId);
            for (const account of accounts) {
                const accountQuery = new AccountQuery(this.providerId, account.label, this.queryService);
                callback(accountQuery);
            }
        }
        catch {
            // Silently handle errors in enumeration
        }
    }
}
/**
 * Implementation of extension query operations (cross-provider)
 */
class ExtensionQuery {
    constructor(extensionId, queryService) {
        this.extensionId = extensionId;
        this.queryService = queryService;
    }
    async getProvidersWithAccess(includeInternal) {
        const providersWithAccess = [];
        const providerIds = this.queryService.authenticationService.getProviderIds();
        for (const providerId of providerIds) {
            // Skip internal providers unless explicitly requested
            if (!includeInternal && providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
                continue;
            }
            try {
                const accounts = await this.queryService.authenticationService.getAccounts(providerId);
                const hasAccess = accounts.some(account => {
                    const accessAllowed = this.queryService.authenticationAccessService.isAccessAllowed(providerId, account.label, this.extensionId);
                    return accessAllowed === true;
                });
                if (hasAccess) {
                    providersWithAccess.push(providerId);
                }
            }
            catch {
                // Skip providers that error
            }
        }
        return providersWithAccess;
    }
    getAllAccountPreferences(includeInternal) {
        const preferences = new Map();
        const providerIds = this.queryService.authenticationService.getProviderIds();
        for (const providerId of providerIds) {
            // Skip internal providers unless explicitly requested
            if (!includeInternal && providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
                continue;
            }
            const preferredAccount = this.queryService.authenticationExtensionsService.getAccountPreference(this.extensionId, providerId);
            if (preferredAccount) {
                preferences.set(providerId, preferredAccount);
            }
        }
        return preferences;
    }
    provider(providerId) {
        return new ProviderExtensionQuery(providerId, this.extensionId, this.queryService);
    }
}
/**
 * Implementation of MCP server query operations (cross-provider)
 */
class McpServerQuery {
    constructor(mcpServerId, queryService) {
        this.mcpServerId = mcpServerId;
        this.queryService = queryService;
    }
    async getProvidersWithAccess(includeInternal) {
        const providersWithAccess = [];
        const providerIds = this.queryService.authenticationService.getProviderIds();
        for (const providerId of providerIds) {
            // Skip internal providers unless explicitly requested
            if (!includeInternal && providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
                continue;
            }
            try {
                const accounts = await this.queryService.authenticationService.getAccounts(providerId);
                const hasAccess = accounts.some(account => {
                    const accessAllowed = this.queryService.authenticationMcpAccessService.isAccessAllowed(providerId, account.label, this.mcpServerId);
                    return accessAllowed === true;
                });
                if (hasAccess) {
                    providersWithAccess.push(providerId);
                }
            }
            catch {
                // Skip providers that error
            }
        }
        return providersWithAccess;
    }
    getAllAccountPreferences(includeInternal) {
        const preferences = new Map();
        const providerIds = this.queryService.authenticationService.getProviderIds();
        for (const providerId of providerIds) {
            // Skip internal providers unless explicitly requested
            if (!includeInternal && providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
                continue;
            }
            const preferredAccount = this.queryService.authenticationMcpService.getAccountPreference(this.mcpServerId, providerId);
            if (preferredAccount) {
                preferences.set(providerId, preferredAccount);
            }
        }
        return preferences;
    }
    provider(providerId) {
        return new ProviderMcpServerQuery(providerId, this.mcpServerId, this.queryService);
    }
}
/**
 * Main implementation of the authentication query service
 */
let AuthenticationQueryService = class AuthenticationQueryService extends Disposable {
    constructor(authenticationService, authenticationUsageService, authenticationMcpUsageService, authenticationAccessService, authenticationMcpAccessService, authenticationExtensionsService, authenticationMcpService, logService) {
        super();
        this.authenticationService = authenticationService;
        this.authenticationUsageService = authenticationUsageService;
        this.authenticationMcpUsageService = authenticationMcpUsageService;
        this.authenticationAccessService = authenticationAccessService;
        this.authenticationMcpAccessService = authenticationMcpAccessService;
        this.authenticationExtensionsService = authenticationExtensionsService;
        this.authenticationMcpService = authenticationMcpService;
        this.logService = logService;
        this._onDidChangePreferences = this._register(new Emitter());
        this.onDidChangePreferences = this._onDidChangePreferences.event;
        this._onDidChangeAccess = this._register(new Emitter());
        this.onDidChangeAccess = this._onDidChangeAccess.event;
        // Forward events from underlying services
        this._register(this.authenticationExtensionsService.onDidChangeAccountPreference(e => {
            this._onDidChangePreferences.fire({
                providerId: e.providerId,
                entityType: 'extension',
                entityIds: e.extensionIds
            });
        }));
        this._register(this.authenticationMcpService.onDidChangeAccountPreference(e => {
            this._onDidChangePreferences.fire({
                providerId: e.providerId,
                entityType: 'mcpServer',
                entityIds: e.mcpServerIds
            });
        }));
        this._register(this.authenticationAccessService.onDidChangeExtensionSessionAccess(e => {
            this._onDidChangeAccess.fire({
                providerId: e.providerId,
                accountName: e.accountName
            });
        }));
        this._register(this.authenticationMcpAccessService.onDidChangeMcpSessionAccess(e => {
            this._onDidChangeAccess.fire({
                providerId: e.providerId,
                accountName: e.accountName
            });
        }));
    }
    provider(providerId) {
        return new ProviderQuery(providerId, this);
    }
    extension(extensionId) {
        return new ExtensionQuery(extensionId, this);
    }
    mcpServer(mcpServerId) {
        return new McpServerQuery(mcpServerId, this);
    }
    getProviderIds(includeInternal) {
        return this.authenticationService.getProviderIds().filter(providerId => {
            // Filter out internal providers unless explicitly included
            return includeInternal || !providerId.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX);
        });
    }
    async clearAllData(confirmation, includeInternal = true) {
        if (confirmation !== 'CLEAR_ALL_AUTH_DATA') {
            throw new Error('Must provide confirmation string to clear all authentication data');
        }
        const providerIds = this.getProviderIds(includeInternal);
        for (const providerId of providerIds) {
            try {
                const accounts = await this.authenticationService.getAccounts(providerId);
                for (const account of accounts) {
                    // Clear extension data
                    this.authenticationAccessService.removeAllowedExtensions(providerId, account.label);
                    this.authenticationUsageService.removeAccountUsage(providerId, account.label);
                    // Clear MCP server data
                    this.authenticationMcpAccessService.removeAllowedMcpServers(providerId, account.label);
                    this.authenticationMcpUsageService.removeAccountUsage(providerId, account.label);
                }
            }
            catch (error) {
                this.logService.error(`Error clearing data for provider ${providerId}:`, error);
            }
        }
        this.logService.info('All authentication data cleared');
    }
};
AuthenticationQueryService = __decorate([
    __param(0, IAuthenticationService),
    __param(1, IAuthenticationUsageService),
    __param(2, IAuthenticationMcpUsageService),
    __param(3, IAuthenticationAccessService),
    __param(4, IAuthenticationMcpAccessService),
    __param(5, IAuthenticationExtensionsService),
    __param(6, IAuthenticationMcpService),
    __param(7, ILogService)
], AuthenticationQueryService);
export { AuthenticationQueryService };
registerSingleton(IAuthenticationQueryService, AuthenticationQueryService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb25RdWVyeVNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYXV0aGVudGljYXRpb25RdWVyeVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JFLE9BQU8sRUFBZ0Msc0JBQXNCLEVBQUUsZ0NBQWdDLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNwSyxPQUFPLEVBQ04sMkJBQTJCLEVBZTNCLE1BQU0sa0NBQWtDLENBQUM7QUFDMUMsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDOUUsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDcEYsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDaEYsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDdEYsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDMUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFM0Y7O0dBRUc7QUFDSCxNQUFlLFNBQVM7SUFDdkIsWUFDaUIsVUFBa0IsRUFDZixZQUF3QztRQUQzQyxlQUFVLEdBQVYsVUFBVSxDQUFRO1FBQ2YsaUJBQVksR0FBWixZQUFZLENB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