/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { resolveWorkbenchCommonProperties } from '../../browser/workbenchCommonProperties.js';
import { InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { hasKey } from '../../../../../base/common/types.js';
suite('Browser Telemetry - common properties', function () {
    const commit = (undefined);
    const version = (undefined);
    let testStorageService;
    teardown(() => {
        testStorageService.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    setup(() => {
        testStorageService = new InMemoryStorageService();
    });
    test('mixes in additional properties', async function () {
        const resolveCommonTelemetryProperties = () => {
            return {
                'userId': '1'
            };
        };
        const props = resolveWorkbenchCommonProperties(testStorageService, commit, version, false, undefined, undefined, false, resolveCommonTelemetryProperties);
        assert.ok(hasKey(props, {
            commitHash: true,
            sessionID: true,
            timestamp: true,
            'common.platform': true,
            'common.timesincesessionstart': true,
            'common.sequence': true,
            version: true,
            'common.firstSessionDate': true,
            'common.lastSessionDate': true,
            'common.isNewSession': true,
            'common.machineId': true
        }));
        assert.strictEqual(props['userId'], '1');
    });
    test('mixes in additional dyanmic properties', async function () {
        let i = 1;
        const resolveCommonTelemetryProperties = () => {
            return Object.defineProperties({}, {
                'userId': {
                    get: () => {
                        return i++;
                    },
                    enumerable: true
                }
            });
        };
        const props = resolveWorkbenchCommonProperties(testStorageService, commit, version, false, undefined, undefined, false, resolveCommonTelemetryProperties);
        assert.strictEqual(props['userId'], 1);
        const props2 = resolveWorkbenchCommonProperties(testStorageService, commit, version, false, undefined, undefined, false, resolveCommonTelemetryProperties);
        assert.strictEqual(props2['userId'], 2);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uUHJvcGVydGllcy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy90ZWxlbWV0cnkvdGVzdC9icm93c2VyL2NvbW1vblByb3BlcnRpZXMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDOUYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDM0YsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTdELEtBQUssQ0FBQyx1Q0FBdUMsRUFBRTtJQUU5QyxNQUFNLE1BQU0sR0FBVyxDQUFDLFNBQVMsQ0FBRSxDQUFDO0lBQ3BDLE1BQU0sT0FBTyxHQUFXLENBQUMsU0FBUyxDQUFFLENBQUM7SUFDckMsSUFBSSxrQkFBMEMsQ0FBQztJQUUvQyxRQUFRLENBQUMsR0FBRyxFQUFFO1FBQ2Isa0JBQWtCLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDOUIsQ0FBQyxDQUFDLENBQUM7SUFFSCx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLEtBQUssQ0FBQyxHQUFHLEVBQUU7UUFDVixrQkFBa0IsR0FBRyxJQUFJLHNCQUFzQixFQUFFLENBQUM7SUFDbkQsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsS0FBSztRQUMzQyxNQUFNLGdDQUFnQyxHQUFHLEdBQUcsRUFBRTtZQUM3QyxPQUFPO2dCQUNOLFFBQVEsRUFBRSxHQUFHO2FBQ2IsQ0FBQztRQUNILENBQUMsQ0FBQztRQUVGLE1BQU0sS0FBSyxHQUFHLGdDQUFnQyxDQUFDLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLGdDQUFnQyxDQUFDLENBQUM7UUFFMUosTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFO1lBQ3ZCLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFNBQVMsRUFBRSxJQUFJO1lBQ2YsU0FBUyxFQUFFLElBQUk7WUFDZixpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLDhCQUE4QixFQUFFLElBQUk7WUFDcEMsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixPQUFPLEVBQUUsSUFBSTtZQUNiLHlCQUF5QixFQUFFLElBQUk7WUFDL0Isd0JBQXdCLEVBQUUsSUFBSTtZQUM5QixxQkFBcUIsRUFBRSxJQUFJO1lBQzNCLGtCQUFrQixFQUFFLElBQUk7U0FDeEIsQ0FBQyxDQUFDLENBQUM7UUFDSixNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMxQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx3Q0FBd0MsRUFBRSxLQUFLO1FBQ25ELElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNWLE1BQU0sZ0NBQWdDLEdBQUcsR0FBRyxFQUFFO1lBQzdDLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsRUFBRTtnQkFDbEMsUUFBUSxFQUFFO29CQUNULEdBQUcsRUFBRSxHQUFHLEVBQUU7d0JBQ1QsT0FBTyxDQUFDLEVBQUUsQ0FBQztvQkFDWixDQUFDO29CQUNELFVBQVUsRUFBRSxJQUFJO2lCQUNoQjthQUNELENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztRQUVGLE1BQU0sS0FBSyxHQUFHLGdDQUFnQyxDQUFDLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLGdDQUFnQyxDQUFDLENBQUM7UUFDMUosTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFdkMsTUFBTSxNQUFNLEdBQUcsZ0NBQWdDLENBQUMsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsZ0NBQWdDLENBQUMsQ0FBQztRQUMzSixNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6QyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=