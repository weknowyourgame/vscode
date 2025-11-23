/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { resolveCommonProperties } from '../../../../platform/telemetry/common/commonProperties.js';
import { firstSessionDateStorageKey, lastSessionDateStorageKey } from '../../../../platform/telemetry/common/telemetry.js';
import { cleanRemoteAuthority } from '../../../../platform/telemetry/common/telemetryUtils.js';
export function resolveWorkbenchCommonProperties(storageService, release, hostname, commit, version, machineId, sqmId, devDeviceId, isInternalTelemetry, process, releaseDate, remoteAuthority) {
    const result = resolveCommonProperties(release, hostname, process.arch, commit, version, machineId, sqmId, devDeviceId, isInternalTelemetry, releaseDate);
    const firstSessionDate = storageService.get(firstSessionDateStorageKey, -1 /* StorageScope.APPLICATION */);
    const lastSessionDate = storageService.get(lastSessionDateStorageKey, -1 /* StorageScope.APPLICATION */);
    // __GDPR__COMMON__ "common.version.shell" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
    result['common.version.shell'] = process.versions?.['electron'];
    // __GDPR__COMMON__ "common.version.renderer" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
    result['common.version.renderer'] = process.versions?.['chrome'];
    // __GDPR__COMMON__ "common.firstSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    result['common.firstSessionDate'] = firstSessionDate;
    // __GDPR__COMMON__ "common.lastSessionDate" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    result['common.lastSessionDate'] = lastSessionDate || '';
    // __GDPR__COMMON__ "common.isNewSession" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    result['common.isNewSession'] = !lastSessionDate ? '1' : '0';
    // __GDPR__COMMON__ "common.remoteAuthority" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth" }
    result['common.remoteAuthority'] = cleanRemoteAuthority(remoteAuthority);
    // __GDPR__COMMON__ "common.cli" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    result['common.cli'] = !!process.env['VSCODE_CLI'];
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2JlbmNoQ29tbW9uUHJvcGVydGllcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdGVsZW1ldHJ5L2NvbW1vbi93b3JrYmVuY2hDb21tb25Qcm9wZXJ0aWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3BHLE9BQU8sRUFBcUIsMEJBQTBCLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUM5SSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUcvRixNQUFNLFVBQVUsZ0NBQWdDLENBQy9DLGNBQStCLEVBQy9CLE9BQWUsRUFDZixRQUFnQixFQUNoQixNQUEwQixFQUMxQixPQUEyQixFQUMzQixTQUFpQixFQUNqQixLQUFhLEVBQ2IsV0FBbUIsRUFDbkIsbUJBQTRCLEVBQzVCLE9BQXFCLEVBQ3JCLFdBQStCLEVBQy9CLGVBQXdCO0lBRXhCLE1BQU0sTUFBTSxHQUFHLHVCQUF1QixDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzFKLE1BQU0sZ0JBQWdCLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsb0NBQTRCLENBQUM7SUFDbkcsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsb0NBQTRCLENBQUM7SUFFakcsc0hBQXNIO0lBQ3RILE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNoRSx5SEFBeUg7SUFDekgsTUFBTSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2pFLG1IQUFtSDtJQUNuSCxNQUFNLENBQUMseUJBQXlCLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQztJQUNyRCxrSEFBa0g7SUFDbEgsTUFBTSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsZUFBZSxJQUFJLEVBQUUsQ0FBQztJQUN6RCwrR0FBK0c7SUFDL0csTUFBTSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0lBQzdELHdIQUF3SDtJQUN4SCxNQUFNLENBQUMsd0JBQXdCLENBQUMsR0FBRyxvQkFBb0IsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUN6RSxzR0FBc0c7SUFDdEcsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBRW5ELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQyJ9