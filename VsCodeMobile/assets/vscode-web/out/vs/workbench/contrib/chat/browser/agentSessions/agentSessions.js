/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../../nls.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { localChatSessionType } from '../../common/chatSessionsService.js';
export const AGENT_SESSIONS_VIEW_CONTAINER_ID = 'workbench.viewContainer.agentSessions';
export const AGENT_SESSIONS_VIEW_ID = 'workbench.view.agentSessions';
export var AgentSessionProviders;
(function (AgentSessionProviders) {
    AgentSessionProviders["Local"] = "local";
    AgentSessionProviders["Background"] = "copilotcli";
    AgentSessionProviders["Cloud"] = "copilot-cloud-agent";
})(AgentSessionProviders || (AgentSessionProviders = {}));
export function getAgentSessionProviderName(provider) {
    switch (provider) {
        case AgentSessionProviders.Local:
            return localize('chat.session.providerLabel.local', "Local");
        case AgentSessionProviders.Background:
            return localize('chat.session.providerLabel.background', "Background");
        case AgentSessionProviders.Cloud:
            return localize('chat.session.providerLabel.cloud', "Cloud");
    }
}
export function getAgentSessionProviderIcon(provider) {
    switch (provider) {
        case AgentSessionProviders.Local:
            return Codicon.vm;
        case AgentSessionProviders.Background:
            return Codicon.collection;
        case AgentSessionProviders.Cloud:
            return Codicon.cloud;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRTZXNzaW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWdlbnRTZXNzaW9ucy9hZ2VudFNlc3Npb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFakUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFM0UsTUFBTSxDQUFDLE1BQU0sZ0NBQWdDLEdBQUcsdUNBQXVDLENBQUM7QUFDeEYsTUFBTSxDQUFDLE1BQU0sc0JBQXNCLEdBQUcsOEJBQThCLENBQUM7QUFFckUsTUFBTSxDQUFOLElBQVkscUJBSVg7QUFKRCxXQUFZLHFCQUFxQjtJQUNoQyx3Q0FBNEIsQ0FBQTtJQUM1QixrREFBeUIsQ0FBQTtJQUN6QixzREFBNkIsQ0FBQTtBQUM5QixDQUFDLEVBSlcscUJBQXFCLEtBQXJCLHFCQUFxQixRQUloQztBQUVELE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxRQUErQjtJQUMxRSxRQUFRLFFBQVEsRUFBRSxDQUFDO1FBQ2xCLEtBQUsscUJBQXFCLENBQUMsS0FBSztZQUMvQixPQUFPLFFBQVEsQ0FBQyxrQ0FBa0MsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM5RCxLQUFLLHFCQUFxQixDQUFDLFVBQVU7WUFDcEMsT0FBTyxRQUFRLENBQUMsdUNBQXVDLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDeEUsS0FBSyxxQkFBcUIsQ0FBQyxLQUFLO1lBQy9CLE9BQU8sUUFBUSxDQUFDLGtDQUFrQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQy9ELENBQUM7QUFDRixDQUFDO0FBRUQsTUFBTSxVQUFVLDJCQUEyQixDQUFDLFFBQStCO0lBQzFFLFFBQVEsUUFBUSxFQUFFLENBQUM7UUFDbEIsS0FBSyxxQkFBcUIsQ0FBQyxLQUFLO1lBQy9CLE9BQU8sT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNuQixLQUFLLHFCQUFxQixDQUFDLFVBQVU7WUFDcEMsT0FBTyxPQUFPLENBQUMsVUFBVSxDQUFDO1FBQzNCLEtBQUsscUJBQXFCLENBQUMsS0FBSztZQUMvQixPQUFPLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDdkIsQ0FBQztBQUNGLENBQUMifQ==