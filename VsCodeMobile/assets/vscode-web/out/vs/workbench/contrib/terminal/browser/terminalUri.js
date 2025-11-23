/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
export function parseTerminalUri(resource) {
    const [, workspaceId, instanceId] = resource.path.split('/');
    if (!workspaceId || !Number.parseInt(instanceId)) {
        throw new Error(`Could not parse terminal uri for resource ${resource}`);
    }
    return { workspaceId, instanceId: Number.parseInt(instanceId) };
}
export function getTerminalUri(workspaceId, instanceId, title, commandId) {
    const params = new URLSearchParams();
    if (commandId) {
        params.set('command', commandId);
    }
    return URI.from({
        scheme: Schemas.vscodeTerminal,
        path: `/${workspaceId}/${instanceId}`,
        fragment: title || undefined,
        query: commandId ? params.toString() : undefined
    });
}
export function getTerminalResourcesFromDragEvent(event) {
    const resources = event.dataTransfer?.getData("Terminals" /* TerminalDataTransfers.Terminals */);
    if (resources) {
        const json = JSON.parse(resources);
        const result = [];
        for (const entry of json) {
            result.push(URI.parse(entry));
        }
        return result.length === 0 ? undefined : result;
    }
    return undefined;
}
export function getInstanceFromResource(instances, resource) {
    if (resource) {
        for (const instance of instances) {
            // Note that the URI's workspace and instance id might not originally be from this window
            // Don't bother checking the scheme and assume instances only contains terminals
            if (instance.resource.path === resource.path) {
                return instance;
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxVcmkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbFVyaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBU3JELE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxRQUFhO0lBQzdDLE1BQU0sQ0FBQyxFQUFFLFdBQVcsRUFBRSxVQUFVLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM3RCxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1FBQ2xELE1BQU0sSUFBSSxLQUFLLENBQUMsNkNBQTZDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUNELE9BQU8sRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztBQUNqRSxDQUFDO0FBRUQsTUFBTSxVQUFVLGNBQWMsQ0FBQyxXQUFtQixFQUFFLFVBQWtCLEVBQUUsS0FBYyxFQUFFLFNBQWtCO0lBQ3pHLE1BQU0sTUFBTSxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7SUFDckMsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFDRCxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDZixNQUFNLEVBQUUsT0FBTyxDQUFDLGNBQWM7UUFDOUIsSUFBSSxFQUFFLElBQUksV0FBVyxJQUFJLFVBQVUsRUFBRTtRQUNyQyxRQUFRLEVBQUUsS0FBSyxJQUFJLFNBQVM7UUFDNUIsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTO0tBQ2hELENBQUMsQ0FBQztBQUNKLENBQUM7QUFZRCxNQUFNLFVBQVUsaUNBQWlDLENBQUMsS0FBd0I7SUFDekUsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLFlBQVksRUFBRSxPQUFPLG1EQUFpQyxDQUFDO0lBQy9FLElBQUksU0FBUyxFQUFFLENBQUM7UUFDZixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ25DLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNsQixLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQzFCLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUNqRCxDQUFDO0lBQ0QsT0FBTyxTQUFTLENBQUM7QUFDbEIsQ0FBQztBQUVELE1BQU0sVUFBVSx1QkFBdUIsQ0FBZ0QsU0FBYyxFQUFFLFFBQXlCO0lBQy9ILElBQUksUUFBUSxFQUFFLENBQUM7UUFDZCxLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2xDLHlGQUF5RjtZQUN6RixnRkFBZ0Y7WUFDaEYsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQzlDLE9BQU8sUUFBUSxDQUFDO1lBQ2pCLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sU0FBUyxDQUFDO0FBQ2xCLENBQUMifQ==