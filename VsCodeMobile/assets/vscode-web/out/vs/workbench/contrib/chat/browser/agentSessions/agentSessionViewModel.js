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
var AgentSessionsCache_1;
import { ThrottledDelayer } from '../../../../../base/common/async.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { IChatSessionsService, localChatSessionType } from '../../common/chatSessionsService.js';
import { AgentSessionProviders, getAgentSessionProviderIcon, getAgentSessionProviderName } from './agentSessions.js';
import { AgentSessionsViewFilter } from './agentSessionsViewFilter.js';
export function isLocalAgentSessionItem(session) {
    return session.providerType === localChatSessionType;
}
export function isAgentSession(obj) {
    const session = obj;
    return URI.isUri(session?.resource);
}
export function isAgentSessionsViewModel(obj) {
    const sessionsViewModel = obj;
    return Array.isArray(sessionsViewModel?.sessions);
}
let AgentSessionsViewModel = class AgentSessionsViewModel extends Disposable {
    get sessions() {
        return this._sessions.filter(session => !this.filter.exclude(session));
    }
    constructor(options, chatSessionsService, lifecycleService, instantiationService, storageService) {
        super();
        this.chatSessionsService = chatSessionsService;
        this.lifecycleService = lifecycleService;
        this.instantiationService = instantiationService;
        this.storageService = storageService;
        this._onWillResolve = this._register(new Emitter());
        this.onWillResolve = this._onWillResolve.event;
        this._onDidResolve = this._register(new Emitter());
        this.onDidResolve = this._onDidResolve.event;
        this._onDidChangeSessions = this._register(new Emitter());
        this.onDidChangeSessions = this._onDidChangeSessions.event;
        this._sessions = [];
        this.resolver = this._register(new ThrottledDelayer(100));
        this.providersToResolve = new Set();
        this.mapSessionToState = new ResourceMap();
        this.filter = this._register(this.instantiationService.createInstance(AgentSessionsViewFilter, { filterMenuId: options.filterMenuId }));
        this.cache = this.instantiationService.createInstance(AgentSessionsCache);
        this._sessions = this.cache.loadCachedSessions();
        this.resolve(undefined);
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.chatSessionsService.onDidChangeItemsProviders(({ chatSessionType: provider }) => this.resolve(provider)));
        this._register(this.chatSessionsService.onDidChangeAvailability(() => this.resolve(undefined)));
        this._register(this.chatSessionsService.onDidChangeSessionItems(provider => this.resolve(provider)));
        this._register(this.filter.onDidChange(() => this._onDidChangeSessions.fire()));
        this._register(this.storageService.onWillSaveState(() => this.cache.saveCachedSessions(this._sessions)));
    }
    async resolve(provider) {
        if (Array.isArray(provider)) {
            for (const p of provider) {
                this.providersToResolve.add(p);
            }
        }
        else {
            this.providersToResolve.add(provider);
        }
        return this.resolver.trigger(async (token) => {
            if (token.isCancellationRequested || this.lifecycleService.willShutdown) {
                return;
            }
            try {
                this._onWillResolve.fire();
                return await this.doResolve(token);
            }
            finally {
                this._onDidResolve.fire();
            }
        });
    }
    async doResolve(token) {
        const providersToResolve = Array.from(this.providersToResolve);
        this.providersToResolve.clear();
        const mapSessionContributionToType = new Map();
        for (const contribution of this.chatSessionsService.getAllChatSessionContributions()) {
            mapSessionContributionToType.set(contribution.type, contribution);
        }
        const resolvedProviders = new Set();
        const sessions = new ResourceMap();
        for (const provider of this.chatSessionsService.getAllChatSessionItemProviders()) {
            if (!providersToResolve.includes(undefined) && !providersToResolve.includes(provider.chatSessionType)) {
                continue; // skip: not considered for resolving
            }
            const providerSessions = await provider.provideChatSessionItems(token);
            resolvedProviders.add(provider.chatSessionType);
            if (token.isCancellationRequested) {
                return;
            }
            for (const session of providerSessions) {
                // Icon + Label
                let icon;
                let providerLabel;
                switch ((provider.chatSessionType)) {
                    case AgentSessionProviders.Local:
                        providerLabel = getAgentSessionProviderName(AgentSessionProviders.Local);
                        icon = getAgentSessionProviderIcon(AgentSessionProviders.Local);
                        break;
                    case AgentSessionProviders.Background:
                        providerLabel = getAgentSessionProviderName(AgentSessionProviders.Background);
                        icon = getAgentSessionProviderIcon(AgentSessionProviders.Background);
                        break;
                    case AgentSessionProviders.Cloud:
                        providerLabel = getAgentSessionProviderName(AgentSessionProviders.Cloud);
                        icon = getAgentSessionProviderIcon(AgentSessionProviders.Cloud);
                        break;
                    default: {
                        providerLabel = mapSessionContributionToType.get(provider.chatSessionType)?.name ?? provider.chatSessionType;
                        icon = session.iconPath ?? Codicon.terminal;
                    }
                }
                // State + Timings
                // TODO@bpasero this is a workaround for not having precise timing info in sessions
                // yet: we only track the time when a transition changes because then we can say with
                // confidence that the time is correct by assuming `Date.now()`. A better approach would
                // be to get all this information directly from the session.
                const status = session.status ?? 1 /* ChatSessionStatus.Completed */;
                const state = this.mapSessionToState.get(session.resource);
                let inProgressTime = state?.inProgressTime;
                let finishedOrFailedTime = state?.finishedOrFailedTime;
                // No previous state, just add it
                if (!state) {
                    this.mapSessionToState.set(session.resource, {
                        status
                    });
                }
                // State changed, update it
                else if (status !== state.status) {
                    inProgressTime = status === 2 /* ChatSessionStatus.InProgress */ ? Date.now() : state.inProgressTime;
                    finishedOrFailedTime = (status !== 2 /* ChatSessionStatus.InProgress */) ? Date.now() : state.finishedOrFailedTime;
                    this.mapSessionToState.set(session.resource, {
                        status,
                        inProgressTime,
                        finishedOrFailedTime
                    });
                }
                sessions.set(session.resource, {
                    providerType: provider.chatSessionType,
                    providerLabel,
                    resource: session.resource,
                    label: session.label,
                    description: session.description,
                    icon,
                    tooltip: session.tooltip,
                    status,
                    archived: session.archived ?? false,
                    timing: {
                        startTime: session.timing.startTime,
                        endTime: session.timing.endTime,
                        inProgressTime,
                        finishedOrFailedTime
                    },
                    statistics: session.statistics,
                });
            }
        }
        for (const session of this._sessions) {
            if (!resolvedProviders.has(session.providerType)) {
                sessions.set(session.resource, session); // fill in existing sessions for providers that did not resolve
            }
        }
        this._sessions.length = 0;
        this._sessions.push(...sessions.values());
        for (const [resource] of this.mapSessionToState) {
            if (!sessions.has(resource)) {
                this.mapSessionToState.delete(resource); // clean up tracking for removed sessions
            }
        }
        this._onDidChangeSessions.fire();
    }
};
AgentSessionsViewModel = __decorate([
    __param(1, IChatSessionsService),
    __param(2, ILifecycleService),
    __param(3, IInstantiationService),
    __param(4, IStorageService)
], AgentSessionsViewModel);
export { AgentSessionsViewModel };
let AgentSessionsCache = class AgentSessionsCache {
    static { AgentSessionsCache_1 = this; }
    static { this.STORAGE_KEY = 'agentSessions.cache'; }
    constructor(storageService) {
        this.storageService = storageService;
    }
    saveCachedSessions(sessions) {
        const serialized = sessions
            .filter(session => 
        // Only consider providers that we own where we know that
        // we can also invalidate the data after startup
        // Other providers are bound to a different lifecycle (extensions)
        session.providerType === AgentSessionProviders.Local ||
            session.providerType === AgentSessionProviders.Background ||
            session.providerType === AgentSessionProviders.Cloud)
            .map(session => ({
            providerType: session.providerType,
            providerLabel: session.providerLabel,
            resource: session.resource.toJSON(),
            icon: session.icon.id,
            label: session.label,
            description: session.description,
            tooltip: session.tooltip,
            status: session.status,
            archived: session.archived,
            timing: {
                startTime: session.timing.startTime,
                endTime: session.timing.endTime,
            },
            statistics: session.statistics,
        }));
        this.storageService.store(AgentSessionsCache_1.STORAGE_KEY, JSON.stringify(serialized), 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
    }
    loadCachedSessions() {
        const sessionsCache = this.storageService.get(AgentSessionsCache_1.STORAGE_KEY, 1 /* StorageScope.WORKSPACE */);
        if (!sessionsCache) {
            return [];
        }
        try {
            const cached = JSON.parse(sessionsCache);
            return cached.map(session => ({
                providerType: session.providerType,
                providerLabel: session.providerLabel,
                resource: URI.revive(session.resource),
                icon: ThemeIcon.fromId(session.icon),
                label: session.label,
                description: session.description,
                tooltip: session.tooltip,
                status: session.status,
                archived: session.archived,
                timing: {
                    startTime: session.timing.startTime,
                    endTime: session.timing.endTime,
                },
                statistics: session.statistics,
            }));
        }
        catch {
            return []; // invalid data in storage, fallback to empty sessions list
        }
    }
};
AgentSessionsCache = AgentSessionsCache_1 = __decorate([
    __param(0, IStorageService)
], AgentSessionsCache);
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRTZXNzaW9uVmlld01vZGVsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hZ2VudFNlc3Npb25zL2FnZW50U2Vzc2lvblZpZXdNb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFdkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxxQ0FBcUMsQ0FBQztBQUVyRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLG1DQUFtQyxDQUFDO0FBRXZFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sbURBQW1ELENBQUM7QUFDakgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFrRCxvQkFBb0IsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2pKLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSwyQkFBMkIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3JILE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBK0N2RSxNQUFNLFVBQVUsdUJBQXVCLENBQUMsT0FBK0I7SUFDdEUsT0FBTyxPQUFPLENBQUMsWUFBWSxL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