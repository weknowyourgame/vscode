/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { release, hostname } from 'os';
import { resolveWorkbenchCommonProperties } from '../../common/workbenchCommonProperties.js';
import { InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { hasKey } from '../../../../../base/common/types.js';
suite('Telemetry - common properties', function () {
    const commit = (undefined);
    const version = (undefined);
    const date = undefined;
    let testStorageService;
    teardown(() => {
        testStorageService.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    setup(() => {
        testStorageService = new InMemoryStorageService();
    });
    test('default', function () {
        const props = resolveWorkbenchCommonProperties(testStorageService, release(), hostname(), commit, version, 'someMachineId', 'someSqmId', 'somedevDeviceId', false, process, date);
        assert.ok(hasKey(props, {
            commitHash: true,
            sessionID: true,
            timestamp: true,
            'common.platform': true,
            'common.nodePlatform': true,
            'common.nodeArch': true,
            'common.timesincesessionstart': true,
            'common.sequence': true,
            // 'common.version.shell': true, // only when running on electron
            // 'common.version.renderer': true,
            'common.platformVersion': true,
            version: true,
            'common.releaseDate': true,
            'common.firstSessionDate': true,
            'common.lastSessionDate': true,
            'common.isNewSession': true,
            'common.machineId': true
        }));
    });
    test('lastSessionDate when available', function () {
        testStorageService.store('telemetry.lastSessionDate', new Date().toUTCString(), -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        const props = resolveWorkbenchCommonProperties(testStorageService, release(), hostname(), commit, version, 'someMachineId', 'someSqmId', 'somedevDeviceId', false, process, date);
        assert.ok(props['common.lastSessionDate']); // conditional, see below
        assert.ok(props['common.isNewSession']);
        assert.strictEqual(props['common.isNewSession'], '0');
    });
    test('values chance on ask', async function () {
        const props = resolveWorkbenchCommonProperties(testStorageService, release(), hostname(), commit, version, 'someMachineId', 'someSqmId', 'somedevDeviceId', false, process, date);
        let value1 = props['common.sequence'];
        let value2 = props['common.sequence'];
        assert.ok(value1 !== value2, 'seq');
        value1 = props['timestamp'];
        value2 = props['timestamp'];
        assert.ok(value1 !== value2, 'timestamp');
        value1 = props['common.timesincesessionstart'];
        await timeout(10);
        value2 = props['common.timesincesessionstart'];
        assert.ok(value1 !== value2, 'timesincesessionstart');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uUHJvcGVydGllcy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy90ZWxlbWV0cnkvdGVzdC9ub2RlL2NvbW1vblByb3BlcnRpZXMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDdkMsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDN0YsT0FBTyxFQUFnQixzQkFBc0IsRUFBaUIsTUFBTSxtREFBbUQsQ0FBQztBQUN4SCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTdELEtBQUssQ0FBQywrQkFBK0IsRUFBRTtJQUN0QyxNQUFNLE1BQU0sR0FBVyxDQUFDLFNBQVMsQ0FBRSxDQUFDO0lBQ3BDLE1BQU0sT0FBTyxHQUFXLENBQUMsU0FBUyxDQUFFLENBQUM7SUFDckMsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDO0lBQ3ZCLElBQUksa0JBQTBDLENBQUM7SUFFL0MsUUFBUSxDQUFDLEdBQUcsRUFBRTtRQUNiLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzlCLENBQUMsQ0FBQyxDQUFDO0lBRUgsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1Ysa0JBQWtCLEdBQUcsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO0lBQ25ELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLFNBQVMsRUFBRTtRQUNmLE1B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