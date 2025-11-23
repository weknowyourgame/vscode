/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import { join } from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { getRandomTestPath } from '../../../base/test/node/testUtils.js';
import { parseServerConnectionToken, ServerConnectionTokenParseError } from '../../node/serverConnectionToken.js';
suite('parseServerConnectionToken', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    function isError(r) {
        return (r instanceof ServerConnectionTokenParseError);
    }
    function assertIsError(r) {
        assert.strictEqual(isError(r), true);
    }
    test('no arguments generates a token that is mandatory', async () => {
        const result = await parseServerConnectionToken({}, async () => 'defaultTokenValue');
        assert.ok(!(result instanceof ServerConnectionTokenParseError));
        assert.ok(result.type === 2 /* ServerConnectionTokenType.Mandatory */);
    });
    test('--without-connection-token', async () => {
        const result = await parseServerConnectionToken({ 'without-connection-token': true }, async () => 'defaultTokenValue');
        assert.ok(!(result instanceof ServerConnectionTokenParseError));
        assert.ok(result.type === 0 /* ServerConnectionTokenType.None */);
    });
    test('--without-connection-token --connection-token results in error', async () => {
        assertIsError(await parseServerConnectionToken({ 'without-connection-token': true, 'connection-token': '0' }, async () => 'defaultTokenValue'));
    });
    test('--without-connection-token --connection-token-file results in error', async () => {
        assertIsError(await parseServerConnectionToken({ 'without-connection-token': true, 'connection-token-file': '0' }, async () => 'defaultTokenValue'));
    });
    test('--connection-token-file --connection-token results in error', async () => {
        assertIsError(await parseServerConnectionToken({ 'connection-token-file': '0', 'connection-token': '0' }, async () => 'defaultTokenValue'));
    });
    test('--connection-token-file', async function () {
        this.timeout(10000);
        const testDir = getRandomTestPath(os.tmpdir(), 'vsctests', 'server-connection-token');
        fs.mkdirSync(testDir, { recursive: true });
        const filename = join(testDir, 'connection-token-file');
        const connectionToken = `12345-123-abc`;
        fs.writeFileSync(filename, connectionToken);
        const result = await parseServerConnectionToken({ 'connection-token-file': filename }, async () => 'defaultTokenValue');
        assert.ok(!(result instanceof ServerConnectionTokenParseError));
        assert.ok(result.type === 2 /* ServerConnectionTokenType.Mandatory */);
        assert.strictEqual(result.value, connectionToken);
        fs.rmSync(testDir, { recursive: true, force: true });
    });
    test('--connection-token', async () => {
        const connectionToken = `12345-123-abc`;
        const result = await parseServerConnectionToken({ 'connection-token': connectionToken }, async () => 'defaultTokenValue');
        assert.ok(!(result instanceof ServerConnectionTokenParseError));
        assert.ok(result.type === 2 /* ServerConnectionTokenType.Mandatory */);
        assert.strictEqual(result.value, connectionToken);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyQ29ubmVjdGlvblRva2VuLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvc2VydmVyL3Rlc3Qvbm9kZS9zZXJ2ZXJDb25uZWN0aW9uVG9rZW4udGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3BELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSwwQkFBMEIsRUFBeUIsK0JBQStCLEVBQTZCLE1BQU0scUNBQXFDLENBQUM7QUFHcEssS0FBSyxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtJQUN4Qyx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLFNBQVMsT0FBTyxDQUFDLENBQTBEO1FBQzFFLE9BQU8sQ0FBQyxDQUFDLFlBQVksK0JBQStCLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQsU0FBUyxhQUFhLENBQUMsQ0FBMEQ7UUFDaEYsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVELElBQUksQ0FBQyxrREFBa0QsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNuRSxNQUFNLE1BQU0sR0FBRyxNQUFNLDBCQUEwQixDQUFDLEVBQXNCLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3pHLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sWUFBWSwrQkFBK0IsQ0FBQyxDQUFDLENBQUM7UUFDaEUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxnREFBd0MsQ0FBQyxDQUFDO0lBQ2hFLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDRCQUE0QixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzdDLE1BQU0sTUFBTSxHQUFHLE1BQU0sMEJBQTBCLENBQUMsRUFBRSwwQkFBMEIsRUFBRSxJQUFJLEVBQXNCLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQzNJLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sWUFBWSwrQkFBK0IsQ0FBQyxDQUFDLENBQUM7UUFDaEUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSwyQ0FBbUMsQ0FBQyxDQUFDO0lBQzNELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdFQUFnRSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2pGLGFBQWEsQ0FBQyxNQUFNLDBCQUEwQixDQUFDLEVBQUUsMEJBQTBCLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLEdBQUcsRUFBc0IsRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztJQUNySyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxxRUFBcUUsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN0RixhQUFhLENBQUMsTUFBTSwwQkFBMEIsQ0FBQyxFQUFFLDBCQUEwQixFQUFFLElBQUksRUFBRSx1QkFBdUIsRUFBRSxHQUFHLEVBQXNCLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7SUFDMUssQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsNkRBQTZELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDOUUsYUFBYSxDQUFDLE1BQU0sMEJBQTBCLENBQUMsRUFBRSx1QkFBdUIsRUFBRSxHQUFHLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxFQUFzQixFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0lBQ2pLLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHlCQUF5QixFQUFFLEtBQUs7UUFDcEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNwQixNQUFNLE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsVUFBVSxFQUFFLHlCQUF5QixDQUFDLENBQUM7UUFDdEYsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMzQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLHVCQUF1QixDQUFDLENBQUM7UUFDeEQsTUFBTSxlQUFlLEdBQUcsZUFBZSxDQUFDO1FBQ3hDLEVBQUUsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQzVDLE1BQU0sTUFBTSxHQUFHLE1BQU0sMEJBQTBCLENBQUMsRUFBRSx1QkFBdUIsRUFBRSxRQUFRLEVBQXNCLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQzVJLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sWUFBWSwrQkFBK0IsQ0FBQyxDQUFDLENBQUM7UUFDaEUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxnREFBd0MsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxlQUFlLENBQUMsQ0FBQztRQUNsRCxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDdEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDckMsTUFBTSxlQUFlLEdBQUcsZUFBZSxDQUFDO1FBQ3hDLE1BQU0sTUFBTSxHQUFHLE1BQU0sMEJBQTBCLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxlQUFlLEVBQXNCLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQzlJLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sWUFBWSwrQkFBK0IsQ0FBQyxDQUFDLENBQUM7UUFDaEUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxnREFBd0MsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxlQUFlLENBQUMsQ0FBQztJQUNuRCxDQUFDLENBQUMsQ0FBQztBQUVKLENBQUMsQ0FBQyxDQUFDIn0=