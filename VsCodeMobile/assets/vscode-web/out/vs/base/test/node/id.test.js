/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { getMachineId, getSqmMachineId, getDevDeviceId } from '../../node/id.js';
import { getMac } from '../../node/macAddress.js';
import { flakySuite } from './testUtils.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';
flakySuite('ID', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('getMachineId', async function () {
        const errors = [];
        const id = await getMachineId(err => errors.push(err));
        assert.ok(id);
        assert.strictEqual(errors.length, 0);
    });
    test('getSqmId', async function () {
        const errors = [];
        const id = await getSqmMachineId(err => errors.push(err));
        assert.ok(typeof id === 'string');
        assert.strictEqual(errors.length, 0);
    });
    test('getDevDeviceId', async function () {
        const errors = [];
        const id = await getDevDeviceId(err => errors.push(err));
        assert.ok(typeof id === 'string');
        assert.strictEqual(errors.length, 0);
    });
    test('getMac', async () => {
        const macAddress = getMac();
        assert.ok(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(macAddress), `Expected a MAC address, got: ${macAddress}`);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWQudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3Rlc3Qvbm9kZS9pZC50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxjQUFjLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDbEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzVDLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRTdFLFVBQVUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0lBQ3JCLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxLQUFLO1FBQ3pCLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNsQixNQUFNLEVBQUUsR0FBRyxNQUFNLFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3RDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLO1FBQ3JCLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNsQixNQUFNLEVBQUUsR0FBRyxNQUFNLGVBQWUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMxRCxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLFFBQVEsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN0QyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLO1FBQzNCLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNsQixNQUFNLEVBQUUsR0FBRyxNQUFNLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN6RCxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLFFBQVEsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN0QyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDekIsTUFBTSxVQUFVLEdBQUcsTUFBTSxFQUFFLENBQUM7UUFDNUIsTUFBTSxDQUFDLEVBQUUsQ0FBQywyQ0FBMkMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsZ0NBQWdDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDdkgsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9