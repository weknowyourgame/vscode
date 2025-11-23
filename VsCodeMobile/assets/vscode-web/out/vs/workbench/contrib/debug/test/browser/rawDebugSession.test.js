/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { mock, mockObject } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { RawDebugSession } from '../../browser/rawDebugSession.js';
import { MockDebugAdapter } from '../common/mockDebug.js';
suite('RawDebugSession', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    function createTestObjects() {
        const debugAdapter = new MockDebugAdapter();
        const dbgr = mockObject()({
            type: 'mock-debug'
        });
        const session = new RawDebugSession(debugAdapter, 
        // eslint-disable-next-line local/code-no-any-casts
        dbgr, 'sessionId', 'name', new (mock()), new (mock()), new (mock()), new (mock()));
        disposables.add(session);
        disposables.add(debugAdapter);
        return { debugAdapter, dbgr };
    }
    test('handles startDebugging request success', async () => {
        const { debugAdapter, dbgr } = createTestObjects();
        dbgr.startDebugging.returns(Promise.resolve(true));
        debugAdapter.sendRequestBody('startDebugging', {
            request: 'launch',
            configuration: {
                type: 'some-other-type'
            }
        });
        const response = await debugAdapter.waitForResponseFromClient('startDebugging');
        assert.strictEqual(response.command, 'startDebugging');
        assert.strictEqual(response.success, true);
    });
    test('handles startDebugging request failure', async () => {
        const { debugAdapter, dbgr } = createTestObjects();
        dbgr.startDebugging.returns(Promise.resolve(false));
        debugAdapter.sendRequestBody('startDebugging', {
            request: 'launch',
            configuration: {
                type: 'some-other-type'
            }
        });
        const response = await debugAdapter.waitForResponseFromClient('startDebugging');
        assert.strictEqual(response.command, 'startDebugging');
        assert.strictEqual(response.success, false);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmF3RGVidWdTZXNzaW9uLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZGVidWcvdGVzdC9icm93c2VyL3Jhd0RlYnVnU2Vzc2lvbi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBS25HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUVuRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUUxRCxLQUFLLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFO0lBQzdCLE1BQU0sV0FBVyxHQUFHLHVDQUF1QyxFQUFFLENBQUM7SUFFOUQsU0FBUyxpQkFBaUI7UUFDekIsTUFBTSxZQUFZLEdBQUcsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO1FBQzVDLE1BQU0sSUFBSSxHQUFHLFVBQVUsRUFBYSxDQUFDO1lBQ3BDLElBQUksRUFBRSxZQUFZO1NBQ2xCLENBQUMsQ0FBQztRQUVILE1BQU0sT0FBTyxHQUFHLElBQUksZUFBZSxDQUNsQyxZQUFZO1FBQ1osbURBQW1EO1FBQ25ELElBQXdCLEVBQ3hCLFdBQVcsRUFDWCxNQUFNLEVBQ04sSUFBSSxDQUFDLElBQUksRUFBOEIsQ0FBQyxFQUN4QyxJQUFJLENBQUMsSUFBSSxFQUFrQixDQUFDLEVBQzVCLElBQUksQ0FBQyxJQUFJLEVBQXdCLENBQUMsRUFDbEMsSUFBSSxDQUFDLElBQUksRUFBa0IsQ0FBQyxDQUFDLENBQUM7UUFDL0IsV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN6QixXQUFXLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTlCLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDL0IsQ0FBQztJQUVELElBQUksQ0FBQyx3Q0FBd0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN6RCxNQUFNLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxHQUFHLGlCQUFpQixFQUFFLENBQUM7UUFDbkQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRW5ELFlBQVksQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLEVBQUU7WUFDOUMsT0FBTyxFQUFFLFFBQVE7WUFDakIsYUFBYSxFQUFFO2dCQUNkLElBQUksRUFBRSxpQkFBaUI7YUFDdkI7U0FDK0MsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sUUFBUSxHQUFHLE1BQU0sWUFBWSxDQUFDLHlCQUF5QixDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDaEYsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzVDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHdDQUF3QyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3pELE1BQU0sRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztRQUNuRCxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFFcEQsWUFBWSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsRUFBRTtZQUM5QyxPQUFPLEVBQUUsUUFBUTtZQUNqQixhQUFhLEVBQUU7Z0JBQ2QsSUFBSSxFQUFFLGlCQUFpQjthQUN2QjtTQUMrQyxDQUFDLENBQUM7UUFDbkQsTUFBTSxRQUFRLEdBQUcsTUFBTSxZQUFZLENBQUMseUJBQXlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNoRixNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDN0MsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9