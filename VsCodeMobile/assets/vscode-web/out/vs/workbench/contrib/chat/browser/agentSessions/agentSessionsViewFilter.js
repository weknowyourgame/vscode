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
var AgentSessionsViewFilter_1;
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { registerAction2, Action2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IChatSessionsService } from '../../common/chatSessionsService.js';
import { AgentSessionProviders, getAgentSessionProviderName } from './agentSessions.js';
const DEFAULT_EXCLUDES = Object.freeze({
    providers: [],
    states: [],
    archived: true,
});
const FILTER_STORAGE_KEY = 'agentSessions.filterExcludes';
export function resetFilter(storageService) {
    const excludes = {
        providers: [...DEFAULT_EXCLUDES.providers],
        states: [...DEFAULT_EXCLUDES.states],
        archived: DEFAULT_EXCLUDES.archived,
    };
    storageService.store(FILTER_STORAGE_KEY, JSON.stringify(excludes), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
}
let AgentSessionsViewFilter = class AgentSessionsViewFilter extends Disposable {
    static { AgentSessionsViewFilter_1 = this; }
    static { this.STORAGE_KEY = FILTER_STORAGE_KEY; }
    constructor(options, chatSessionsService, storageService) {
        super();
        this.options = options;
        this.chatSessionsService = chatSessionsService;
        this.storageService = storageService;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.excludes = DEFAULT_EXCLUDES;
        this.actionDisposables = this._register(new DisposableStore());
        this.updateExcludes(false);
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.chatSessionsService.onDidChangeItemsProviders(() => this.updateFilterActions()));
        this._register(this.chatSessionsService.onDidChangeAvailability(() => this.updateFilterActions()));
        this._register(this.storageService.onDidChangeValue(0 /* StorageScope.PROFILE */, AgentSessionsViewFilter_1.STORAGE_KEY, this._store)(() => this.updateExcludes(true)));
    }
    updateExcludes(fromEvent) {
        const excludedTypesRaw = this.storageService.get(AgentSessionsViewFilter_1.STORAGE_KEY, 0 /* StorageScope.PROFILE */);
        this.excludes = excludedTypesRaw ? JSON.parse(excludedTypesRaw) : {
            providers: [...DEFAULT_EXCLUDES.providers],
            states: [...DEFAULT_EXCLUDES.states],
            archived: DEFAULT_EXCLUDES.archived,
        };
        this.updateFilterActions();
        if (fromEvent) {
            this._onDidChange.fire();
        }
    }
    storeExcludes(excludes) {
        this.excludes = excludes;
        this.storageService.store(AgentSessionsViewFilter_1.STORAGE_KEY, JSON.stringify(this.excludes), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
    }
    updateFilterActions() {
        this.actionDisposables.clear();
        this.registerProviderActions(this.actionDisposables);
        this.registerStateActions(this.actionDisposables);
        this.registerArchivedActions(this.actionDisposables);
    }
    registerProviderActions(disposables) {
        const providers = [
            { id: AgentSessionProviders.Local, label: getAgentSessionProviderName(AgentSessionProviders.Local) },
            { id: AgentSessionProviders.Background, label: getAgentSessionProviderName(AgentSessionProviders.Background) },
            { id: AgentSessionProviders.Cloud, label: getAgentSessionProviderName(AgentSessionProviders.Cloud) },
        ];
        for (const provider of this.chatSessionsService.getAllChatSessionContributions()) {
            if (providers.find(p => p.id === provider.type)) {
                continue; // already added
            }
            providers.push({ id: provider.type, label: provider.name });
        }
        const that = this;
        let counter = 0;
        for (const provider of providers) {
            disposables.add(registerAction2(class extends Action2 {
                constructor() {
                    super({
                        id: `agentSessions.filter.toggleExclude:${provider.id}`,
                        title: provider.label,
                        menu: {
                            id: that.options.filterMenuId,
                            group: '1_providers',
                            order: counter++,
                        },
                        toggled: that.excludes.providers.includes(provider.id) ? ContextKeyExpr.false() : ContextKeyExpr.true(),
                    });
                }
                run() {
                    const providerExcludes = new Set(that.excludes.providers);
                    if (!providerExcludes.delete(provider.id)) {
                        providerExcludes.add(provider.id);
                    }
                    that.storeExcludes({ ...that.excludes, providers: Array.from(providerExcludes) });
                }
            }));
        }
    }
    registerStateActions(disposables) {
        const states = [
            { id: 1 /* ChatSessionStatus.Completed */, label: localize('chatSessionStatus.completed', "Completed") },
            { id: 2 /* ChatSessionStatus.InProgress */, label: localize('chatSessionStatus.inProgress', "In Progress") },
            { id: 0 /* ChatSessionStatus.Failed */, label: localize('chatSessionStatus.failed', "Failed") },
        ];
        const that = this;
        let counter = 0;
        for (const state of states) {
            disposables.add(registerAction2(class extends Action2 {
                constructor() {
                    super({
                        id: `agentSessions.filter.toggleExcludeState:${state.id}`,
                        title: state.label,
                        menu: {
                            id: that.options.filterMenuId,
                            group: '2_states',
                            order: counter++,
                        },
                        toggled: that.excludes.states.includes(state.id) ? ContextKeyExpr.false() : ContextKeyExpr.true(),
                    });
                }
                run() {
                    const stateExcludes = new Set(that.excludes.states);
                    if (!stateExcludes.delete(state.id)) {
                        stateExcludes.add(state.id);
                    }
                    that.storeExcludes({ ...that.excludes, states: Array.from(stateExcludes) });
                }
            }));
        }
    }
    registerArchivedActions(disposables) {
        const that = this;
        disposables.add(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'agentSessions.filter.toggleExcludeArchived',
                    title: localize('agentSessions.filter.archived', 'Archived'),
                    menu: {
                        id: that.options.filterMenuId,
                        group: '2_states',
                        order: 1000,
                    },
                    toggled: that.excludes.archived ? ContextKeyExpr.false() : ContextKeyExpr.true(),
                });
            }
            run() {
                that.storeExcludes({ ...that.excludes, archived: !that.excludes.archived });
            }
        }));
    }
    exclude(session) {
        if (this.excludes.archived && session.archived) {
            return true;
        }
        if (this.excludes.providers.includes(session.providerType)) {
            return true;
        }
        if (this.excludes.states.includes(session.status)) {
            return true;
        }
        return false;
    }
};
AgentSessionsViewFilter = AgentSessionsViewFilter_1 = __decorate([
    __param(1, IChatSessionsService),
    __param(2, IStorageService)
], AgentSessionsViewFilter);
export { AgentSessionsViewFilter };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRTZXNzaW9uc1ZpZXdGaWx0ZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2FnZW50U2Vzc2lvbnMvYWdlbnRTZXNzaW9uc1ZpZXdGaWx0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBVSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLG1EQUFtRCxDQUFDO0FBQ2pILE9BQU8sRUFBcUIsb0JBQW9CLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQWF4RixNQUFNLGdCQUFnQixHQUErQixNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2xFLFNBQVMsRUFBRSxFQUFXO0lBQ3RCLE1BQU0sRUFBRSxFQUFXO0lBQ25CLFFBQVEsRUFBRSxJQUFhO0NBQ3ZCLENBQUMsQ0FBQztBQUVILE1BQU0sa0JBQWtCLEdBQUcsOEJBQThCLENBQUM7QUFFMUQsTUFBTSxVQUFVLFdBQVcsQ0FBQyxjQUErQjtJQUMxRCxNQUFNLFFBQVEsR0FBRztRQUNoQixTQUFTLEVBQUUsQ0FBQyxHQUFHLGdCQUFnQixDQUFDLFNBQVMsQ0FBQztRQUMxQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLGdC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