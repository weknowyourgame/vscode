/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getDevDeviceId } from '../../../base/node/id.js';
import { machineIdKey, sqmIdKey, devDeviceIdKey } from '../common/telemetry.js';
import { resolveMachineId as resolveNodeMachineId, resolveSqmId as resolveNodeSqmId, resolveDevDeviceId as resolveNodeDevDeviceId } from '../node/telemetryUtils.js';
export async function resolveMachineId(stateService, logService) {
    logService.trace('Resolving machine identifier...');
    const machineId = await resolveNodeMachineId(stateService, logService);
    stateService.setItem(machineIdKey, machineId);
    logService.trace(`Resolved machine identifier: ${machineId}`);
    return machineId;
}
export async function resolveSqmId(stateService, logService) {
    logService.trace('Resolving SQM identifier...');
    const sqmId = await resolveNodeSqmId(stateService, logService);
    stateService.setItem(sqmIdKey, sqmId);
    logService.trace(`Resolved SQM identifier: ${sqmId}`);
    return sqmId;
}
export async function resolveDevDeviceId(stateService, logService) {
    logService.trace('Resolving devDevice identifier...');
    const devDeviceId = await resolveNodeDevDeviceId(stateService, logService);
    stateService.setItem(devDeviceIdKey, devDeviceId);
    logService.trace(`Resolved devDevice identifier: ${devDeviceId}`);
    return devDeviceId;
}
export async function validateDevDeviceId(stateService, logService) {
    const actualDeviceId = await getDevDeviceId(logService.error.bind(logService));
    const currentDeviceId = await resolveNodeDevDeviceId(stateService, logService);
    if (actualDeviceId !== currentDeviceId) {
        stateService.setItem(devDeviceIdKey, actualDeviceId);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVsZW1ldHJ5VXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdGVsZW1ldHJ5L2VsZWN0cm9uLW1haW4vdGVsZW1ldHJ5VXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRzFELE9BQU8sRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ2hGLE9BQU8sRUFBRSxnQkFBZ0IsSUFBSSxvQkFBb0IsRUFBRSxZQUFZLElBQUksZ0JBQWdCLEVBQUUsa0JBQWtCLElBQUksc0JBQXNCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUVySyxNQUFNLENBQUMsS0FBSyxVQUFVLGdCQUFnQixDQUFDLFlBQTJCLEVBQUUsVUFBdUI7SUFDMUYsVUFBVSxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0lBQ3BELE1BQU0sU0FBUyxHQUFHLE1BQU0sb0JBQW9CLENBQUMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3ZFLFlBQVksQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzlDLFVBQVUsQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDOUQsT0FBTyxTQUFTLENBQUM7QUFDbEIsQ0FBQztBQUVELE1BQU0sQ0FBQyxLQUFLLFVBQVUsWUFBWSxDQUFDLFlBQTJCLEVBQUUsVUFBdUI7SUFDdEYsVUFBVSxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0lBQ2hELE1BQU0sS0FBSyxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQy9ELFlBQVksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3RDLFVBQVUsQ0FBQyxLQUFLLENBQUMsNEJBQTRCLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDdEQsT0FBTyxLQUFLLENBQUM7QUFDZCxDQUFDO0FBRUQsTUFBTSxDQUFDLEtBQUssVUFBVSxrQkFBa0IsQ0FBQyxZQUEyQixFQUFFLFVBQXVCO0lBQzVGLFVBQVUsQ0FBQyxLQUFLLENBQUMsbUNBQW1DLENBQUMsQ0FBQztJQUN0RCxNQUFNLFdBQVcsR0FBRyxNQUFNLHNCQUFzQixDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMzRSxZQUFZLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUNsRCxVQUFVLENBQUMsS0FBSyxDQUFDLGtDQUFrQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ2xFLE9BQU8sV0FBVyxDQUFDO0FBQ3BCLENBQUM7QUFFRCxNQUFNLENBQUMsS0FBSyxVQUFVLG1CQUFtQixDQUFDLFlBQTJCLEVBQUUsVUFBdUI7SUFDN0YsTUFBTSxjQUFjLEdBQUcsTUFBTSxjQUFjLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUMvRSxNQUFNLGVBQWUsR0FBRyxNQUFNLHNCQUFzQixDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUMvRSxJQUFJLGNBQWMsS0FBSyxlQUFlLEVBQUUsQ0FBQztRQUN4QyxZQUFZLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUN0RCxDQUFDO0FBQ0YsQ0FBQyJ9