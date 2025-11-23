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
import { Codicon } from '../../../../../../base/common/codicons.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import * as nls from '../../../../../../nls.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../../platform/contextview/browser/contextView.js';
import { SyncDescriptor } from '../../../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { IProductService } from '../../../../../../platform/product/common/productService.js';
import { Registry } from '../../../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { registerIcon } from '../../../../../../platform/theme/common/iconRegistry.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { IWorkspaceContextService } from '../../../../../../platform/workspace/common/workspace.js';
import { ViewPaneContainer } from '../../../../../browser/parts/views/viewPaneContainer.js';
import { Extensions, IViewDescriptorService } from '../../../../../common/views.js';
import { IExtensionService } from '../../../../../services/extensions/common/extensions.js';
import { IWorkbenchLayoutService } from '../../../../../services/layout/browser/layoutService.js';
import { ChatContextKeyExprs } from '../../../common/chatContextKeys.js';
import { IChatSessionsService, localChatSessionType } from '../../../common/chatSessionsService.js';
import { LEGACY_AGENT_SESSIONS_VIEW_ID } from '../../../common/constants.js';
import { ACTION_ID_OPEN_CHAT } from '../../actions/chatActions.js';
import { ChatSessionTracker } from '../chatSessionTracker.js';
import { SessionsViewPane } from './sessionsViewPane.js';
export class ChatSessionsView extends Disposable {
    static { this.ID = 'workbench.contrib.chatSessionsView'; }
    constructor() {
        super();
        this.registerViewContainer();
    }
    registerViewContainer() {
        Registry.as(Extensions.ViewContainersRegistry).registerViewContainer({
            id: LEGACY_AGENT_SESSIONS_VIEW_ID,
            title: nls.localize2('chat.agent.sessions', "Agent Sessions"),
            ctorDescriptor: new SyncDescriptor(ChatSessionsViewPaneContainer),
            hideIfEmpty: true,
            icon: registerIcon('chat-sessions-icon', Codicon.commentDiscussionSparkle, 'Icon for Agent Sessions View'),
            order: 6
        }, 0 /* ViewContainerLocation.Sidebar */);
    }
}
let ChatSessionsViewContrib = class ChatSessionsViewContrib extends Disposable {
    static { this.ID = 'workbench.contrib.chatSessions'; }
    constructor(instantiationService, chatSessionsService, logService, productService) {
        super();
        this.instantiationService = instantiationService;
        this.chatSessionsService = chatSessionsService;
        this.logService = logService;
        this.productService = productService;
        this.registeredViewDescriptors = new Map();
        this.sessionTracker = this._register(this.instantiationService.createInstance(ChatSessionTracker));
        // Initial check
        void this.updateViewRegistration();
        this._register(this.chatSessionsService.onDidChangeItemsProviders(() => {
            void this.updateViewRegistration();
        }));
        this._register(this.chatSessionsService.onDidChangeAvailability(() => {
            void this.updateViewRegistration();
        }));
    }
    getAllChatSessionItemProviders() {
        return Array.from(this.chatSessionsService.getAllChatSessionItemProviders());
    }
    async updateViewRegistration() {
        // prepare all chat session providers
        const contributions = this.chatSessionsService.getAllChatSessionContributions();
        await Promise.all(contributions.map(contrib => this.chatSessionsService.activateChatSessionItemProvider(contrib.type)));
        const currentProviders = this.getAllChatSessionItemProviders();
        const currentProviderIds = new Set(currentProviders.map(p => p.chatSessionType));
        // Find views that need to be unregistered (providers that are no longer available)
        const viewsToUnregister = [];
        for (const [providerId, viewDescriptor] of this.registeredViewDescriptors.entries()) {
            if (!currentProviderIds.has(providerId)) {
                viewsToUnregister.push(viewDescriptor);
                this.registeredViewDescriptors.delete(providerId);
            }
        }
        // Unregister removed views
        if (viewsToUnregister.length > 0) {
            const container = Registry.as(Extensions.ViewContainersRegistry).get(LEGACY_AGENT_SESSIONS_VIEW_ID);
            if (container) {
                Registry.as(Extensions.ViewsRegistry).deregisterViews(viewsToUnregister, container);
            }
        }
        // Register new views
        this.registerViews(contributions);
    }
    async registerViews(extensionPointContributions) {
        const container = Registry.as(Extensions.ViewContainersRegistry).get(LEGACY_AGENT_SESSIONS_VIEW_ID);
        const providers = this.getAllChatSessionItemProviders();
        if (container && providers.length > 0) {
            const viewDescriptorsToRegister = [];
            // Separate providers by type and prepare display names with order
            const localProvider = providers.find(p => p.chatSessionType === localChatSessionType);
            const historyProvider = providers.find(p => p.chatSessionType === 'history');
            const otherProviders = providers.filter(p => p.chatSessionType !== localChatSessionType && p.chatSessionType !== 'history');
            // Sort other providers by order, then alphabetically by display name
            const providersWithDisplayNames = otherProviders.map(provider => {
                const extContribution = extensionPointContributions.find(c => c.type === provider.chatSessionType);
                if (!extContribution) {
                    this.logService.warn(`No extension contribution found for chat session type: ${provider.chatSessionType}`);
                    return null;
                }
                return {
                    provider,
                    displayName: extContribution.displayName,
                    order: extContribution.order
                };
            }).filter(item => item !== null);
            providersWithDisplayNames.sort((a, b) => {
                // Both have no order - sort by display name
                if (a.order === undefined && b.order === undefined) {
                    return a.displayName.localeCompare(b.displayName);
                }
                // Only a has no order - push it to the end
                if (a.order === undefined) {
                    return 1;
                }
                // Only b has no order - push it to the end
                if (b.order === undefined) {
                    return -1;
                }
                // Both have orders - compare numerically
                const orderCompare = a.order - b.order;
                if (orderCompare !== 0) {
                    return orderCompare;
                }
                // Same order - sort by display name
                return a.displayName.localeCompare(b.displayName);
            });
            // Register views in priority order: local, history, then alphabetically sorted others
            const orderedProviders = [
                ...(localProvider ? [{ provider: localProvider, displayName: 'Local Chat Agent', baseOrder: 0, when: ChatContextKeyExprs.agentViewWhen }] : []),
                ...(historyProvider ? [{ provider: historyProvider, displayName: 'History', baseOrder: 1, when: ChatContextKeyExprs.agentViewWhen }] : []),
                ...providersWithDisplayNames.map((item, index) => ({
                    ...item,
                    baseOrder: 2 + index, // Start from 2 for other providers
                    when: ChatContextKeyExprs.agentViewWhen,
                }))
            ];
            orderedProviders.forEach(({ provider, displayName, baseOrder, when }) => {
                // Only register if not already registered
                if (!this.registeredViewDescriptors.has(provider.chatSessionType)) {
                    const viewId = `${LEGACY_AGENT_SESSIONS_VIEW_ID}.${provider.chatSessionType}`;
                    const viewDescriptor = {
                        id: viewId,
                        name: {
                            value: displayName,
                            original: displayName,
                        },
                        ctorDescriptor: new SyncDescriptor(SessionsViewPane, [provider, this.sessionTracker, viewId]),
                        canToggleVisibility: true,
                        canMoveView: true,
                        order: baseOrder, // Use computed order based on priority and alphabetical sorting
                        when,
                    };
                    viewDescriptorsToRegister.push(viewDescriptor);
                    this.registeredViewDescriptors.set(provider.chatSessionType, viewDescriptor);
                    if (provider.chatSessionType === localChatSessionType) {
                        const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
                        this._register(viewsRegistry.registerViewWelcomeContent(viewDescriptor.id, {
                            content: nls.localize('chatSessions.noResults', "No local chat agent sessions\n[Start an Agent Session](command:{0})", ACTION_ID_OPEN_CHAT),
                        }));
                    }
                }
            });
            const gettingStartedViewId = `${LEGACY_AGENT_SESSIONS_VIEW_ID}.gettingStarted`;
            if (!this.registeredViewDescriptors.has('gettingStarted')
                && this.productService.chatSessionRecommendations?.length) {
                const gettingStartedDescriptor = {
                    id: gettingStartedViewId,
                    name: {
                        value: nls.localize('chat.sessions.gettingStarted', "Getting Started"),
                        original: 'Getting Started',
                    },
                    ctorDescriptor: new SyncDescriptor(SessionsViewPane, [null, this.sessionTracker, gettingStartedViewId]),
                    canToggleVisibility: true,
                    canMoveView: true,
                    order: 1000,
                    collapsed: !!otherProviders.length,
                    when: ContextKeyExpr.false()
                };
                viewDescriptorsToRegister.push(gettingStartedDescriptor);
                this.registeredViewDescriptors.set('gettingStarted', gettingStartedDescriptor);
            }
            if (viewDescriptorsToRegister.length > 0) {
                Registry.as(Extensions.ViewsRegistry).registerViews(viewDescriptorsToRegister, container);
            }
        }
    }
    dispose() {
        // Unregister all views before disposal
        if (this.registeredViewDescriptors.size > 0) {
            const container = Registry.as(Extensions.ViewContainersRegistry).get(LEGACY_AGENT_SESSIONS_VIEW_ID);
            if (container) {
                const allRegisteredViews = Array.from(this.registeredViewDescriptors.values());
                Registry.as(Extensions.ViewsRegistry).deregisterViews(allRegisteredViews, container);
            }
            this.registeredViewDescriptors.clear();
        }
        super.dispose();
    }
};
ChatSessionsViewContrib = __decorate([
    __param(0, IInstantiationService),
    __param(1, IChatSessionsService),
    __param(2, ILogService),
    __param(3, IProductService)
], ChatSessionsViewContrib);
export { ChatSessionsViewContrib };
// Chat sessions container
let ChatSessionsViewPaneContainer = class ChatSessionsViewPaneContainer extends ViewPaneContainer {
    constructor(instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService, logService) {
        super(LEGACY_AGENT_SESSIONS_VIEW_ID, {
            mergeViewWithContainerWhenSingleView: false,
        }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService, logService);
    }
    getTitle() {
        const title = nls.localize('chat.agent.sessions.title', "Agent Sessions");
        return title;
    }
};
ChatSessionsViewPaneContainer = __decorate([
    __param(0, IInstantiationService),
    __param(1, IConfigurationService),
    __param(2, IWorkbenchLayoutService),
    __param(3, IContextMenuService),
    __param(4, ITelemetryService),
    __param(5, IExtensionService),
    __param(6, IThemeService),
    __param(7, IStorageService),
    __param(8, IWorkspaceContextService),
    __param(9, IViewDescriptorService),
    __param(10, ILogService)
], ChatSessionsViewPaneContainer);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlc3Npb25zVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFNlc3Npb25zL3ZpZXcvY2hhdFNlc3Npb25zVmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3hFLE9BQU8sS0FBSyxHQUFHLE1BQU0sMEJBQTBCLENBQUM7QUFDaEQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzVGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUNoRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNsRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdkYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDN0YsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFB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