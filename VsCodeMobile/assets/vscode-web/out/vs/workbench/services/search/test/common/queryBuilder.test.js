/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import * as glob from '../../../../../base/common/glob.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { testWorkspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { escapeGlobPattern, resolveResourcesForSearchIncludes } from '../../common/queryBuilder.js';
import { TestContextService } from '../../../../test/common/workbenchTestServices.js';
suite('QueryBuilderCommon', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    let context;
    setup(() => {
        const workspace = testWorkspace(URI.file(isWindows ? 'C:\\testWorkspace' : '/testWorkspace'));
        context = new TestContextService(workspace);
    });
    test('resolveResourcesForSearchIncludes passes through paths without special glob characters', () => {
        const actual = resolveResourcesForSearchIncludes([URI.file(isWindows ? 'C:\\testWorkspace\\pages\\blog' : '/testWorkspace/pages/blog')], context);
        assert.deepStrictEqual(actual, ['./pages/blog']);
    });
    test('resolveResourcesForSearchIncludes escapes paths with special characters', () => {
        const actual = resolveResourcesForSearchIncludes([URI.file(isWindows ? 'C:\\testWorkspace\\pages\\blog\\[postId]' : '/testWorkspace/pages/blog/[postId]')], context);
        assert.deepStrictEqual(actual, ['./pages/blog/[[]postId[]]']);
    });
    test('escapeGlobPattern properly escapes square brackets for literal matching', () => {
        // This test verifies the fix for issue #233049 where files with square brackets in names
        // were not found when using "Search Only in Open Editors"
        // Test file name with square brackets
        const fileName = 'file[test].txt';
        // Without escaping, the pattern treats [test] as a character class
        const unescapedResult = glob.match(fileName, fileName);
        assert.strictEqual(unescapedResult, false, 'Unescaped pattern should not match due to character class interpretation');
        // With escaping, the pattern matches literally
        const escapedPattern = escapeGlobPattern(fileName);
        const escapedResult = glob.match(escapedPattern, fileName);
        assert.strictEqual(escapedResult, true, 'Escaped pattern should match literally');
        assert.strictEqual(escapedPattern, 'file[[]test[]].txt', 'Pattern should have escaped brackets');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVlcnlCdWlsZGVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3NlYXJjaC90ZXN0L2NvbW1vbi9xdWVyeUJ1aWxkZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxLQUFLLElBQUksTUFBTSxvQ0FBb0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbkUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRW5HLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUMvRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNwRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUV0RixLQUFLLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO0lBQ2hDLHVDQUF1QyxFQUFFLENBQUM7SUFDMUMsSUFBSSxPQUFpQyxDQUFDO0lBRXRDLEtBQUssQ0FBQyxHQUFHLEVBQUU7UUFDVixNQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7UUFDOUYsT0FBTyxHQUFHLElBQUksa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDN0MsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsd0ZBQXdGLEVBQUUsR0FBRyxFQUFFO1FBQ25HLE1BQU0sTUFBTSxHQUFHLGlDQUFpQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLGdDQUFnQyxDQUFDLENBQUMsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbEosTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO0lBQ2xELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHlFQUF5RSxFQUFFLEdBQUcsRUFBRTtRQUNwRixNQUFNLE1BQU0sR0FBRyxpQ0FBaUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDLENBQUMsb0NBQW9DLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3JLLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDO0lBQy9ELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHlFQUF5RSxFQUFFLEdBQUcsRUFBRTtRQUNwRix5RkFBeUY7UUFDekYsMERBQTBEO1FBRTFELHNDQUFzQztRQUN0QyxNQUFNLFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQztRQUVsQyxtRUFBbUU7UUFDbkUsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxlQUFlLEVBQUUsS0FBSyxFQUFFLDBFQUEwRSxDQUFDLENBQUM7UUFFdkgsK0NBQStDO1FBQy9DLE1BQU0sY0FBYyxHQUFHLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzNELE1BQU0sQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFLElBQUksRUFBRSx3Q0FBd0MsQ0FBQyxDQUFDO1FBQ2xGLE1BQU0sQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLG9CQUFvQixFQUFFLHNDQUFzQyxDQUFDLENBQUM7SUFDbEcsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9