/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export const NODE_REMOTE_RESOURCE_IPC_METHOD_NAME = 'request';
export const NODE_REMOTE_RESOURCE_CHANNEL_NAME = 'remoteResourceHandler';
export class NodeRemoteResourceRouter {
    async routeCall(hub, command, arg) {
        if (command !== NODE_REMOTE_RESOURCE_IPC_METHOD_NAME) {
            throw new Error(`Call not found: ${command}`);
        }
        const uri = Array.isArray(arg) ? arg[0] : undefined;
        if (uri?.authority) {
            const connection = hub.connections.find(c => c.ctx === uri.authority);
            if (connection) {
                return connection;
            }
        }
        throw new Error(`Caller not found`);
    }
    routeEvent(_, event) {
        throw new Error(`Event not found: ${event}`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlY3Ryb25SZW1vdGVSZXNvdXJjZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9lbGVjdHJvblJlbW90ZVJlc291cmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUtoRyxNQUFNLENBQUMsTUFBTSxvQ0FBb0MsR0FBRyxTQUFTLENBQUM7QUFFOUQsTUFBTSxDQUFDLE1BQU0saUNBQWlDLEdBQUcsdUJBQXVCLENBQUM7QUFJekUsTUFBTSxPQUFPLHdCQUF3QjtJQUNwQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQTJCLEVBQUUsT0FBZSxFQUFFLEdBQWE7UUFDMUUsSUFBSSxPQUFPLEtBQUssb0NBQW9DLEVBQUUsQ0FBQztZQUN0RCxNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQy9DLENBQUM7UUFFRCxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFnQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDbkYsSUFBSSxHQUFHLEVBQUUsU0FBUyxFQUFFLENBQUM7WUFDcEIsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN0RSxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUNoQixPQUFPLFVBQVUsQ0FBQztZQUNuQixDQUFDO1FBQ0YsQ0FBQztRQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQsVUFBVSxDQUFDLENBQXlCLEVBQUUsS0FBYTtRQUNsRCxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7Q0FDRCJ9