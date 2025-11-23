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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ChatContextKeys } from '../../chat/common/chatContextKeys.js';
export const IRemoteCodingAgentsService = createDecorator('remoteCodingAgentsService');
let RemoteCodingAgentsService = class RemoteCodingAgentsService extends Disposable {
    constructor(contextKeyService) {
        super();
        this.contextKeyService = contextKeyService;
        this.agents = [];
        this.contextKeys = new Set();
        this._ctxHasRemoteCodingAgent = ChatContextKeys.hasRemoteCodingAgent.bindTo(this.contextKeyService);
        // Listen for context changes and re-evaluate agent availability
        this._register(Event.filter(contextKeyService.onDidChangeContext, e => e.affectsSome(this.contextKeys))(() => {
            this.updateContextKeys();
        }));
    }
    getRegisteredAgents() {
        return [...this.agents];
    }
    getAvailableAgents() {
        return this.agents.filter(agent => this.isAgentAvailable(agent));
    }
    registerAgent(agent) {
        // Check if agent already exists
        const existingIndex = this.agents.findIndex(a => a.id === agent.id);
        if (existingIndex >= 0) {
            // Update existing agent
            this.agents[existingIndex] = agent;
        }
        else {
            // Add new agent
            this.agents.push(agent);
        }
        // Track context keys from the when condition
        if (agent.when) {
            const whenExpr = ContextKeyExpr.deserialize(agent.when);
            if (whenExpr) {
                for (const key of whenExpr.keys()) {
                    this.contextKeys.add(key);
                }
            }
        }
        this.updateContextKeys();
    }
    isAgentAvailable(agent) {
        if (!agent.when) {
            return true;
        }
        const whenExpr = ContextKeyExpr.deserialize(agent.when);
        return !whenExpr || this.contextKeyService.contextMatchesRules(whenExpr);
    }
    updateContextKeys() {
        const hasAvailableAgent = this.getAvailableAgents().length > 0;
        this._ctxHasRemoteCodingAgent.set(hasAvailableAgent);
    }
};
RemoteCodingAgentsService = __decorate([
    __param(0, IContextKeyService)
], RemoteCodingAgentsService);
export { RemoteCodingAgentsService };
registerSingleton(IRemoteCodingAgentsService, RemoteCodingAgentsService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3RlQ29kaW5nQWdlbnRzU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGVDb2RpbmdBZ2VudHMvY29tbW9uL3JlbW90ZUNvZGluZ0FnZW50c1NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsY0FBYyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdkgsT0FBTyxFQUFxQixpQkFBaUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUM3RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFrQnZFLE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixHQUFHLGVBQWUsQ0FBNkIsMkJBQTJCLENBQUMsQ0FBQztBQUU1RyxJQUFNLHlCQUF5QixHQUEvQixNQUFNLHlCQUEwQixTQUFRLFVBQVU7SUFNeEQsWUFDcUIsaUJBQXNEO1FBRTFFLEtBQUssRUFBRSxDQUFDO1FBRjZCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFKMUQsV0FBTSxHQUF5QixFQUFFLENBQUM7UUFDbEMsZ0JBQVcsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBTWhELElBQUksQ0FBQyx3QkFBd0IsR0FBRyxlQUFlLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRXBHLGdFQUFnRTtRQUNoRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsaUJB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