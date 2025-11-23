/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { getCleanPromptName, isPromptOrInstructionsFile } from '../../../../common/promptSyntax/config/promptFileLocations.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { URI } from '../../../../../../../base/common/uri.js';
suite('Prompt Constants', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('getCleanPromptName', () => {
        test('returns a clean prompt name', () => {
            assert.strictEqual(getCleanPromptName(URI.file('/path/to/my-prompt.prompt.md')), 'my-prompt');
            assert.strictEqual(getCleanPromptName(URI.file('../common.prompt.md')), 'common');
            const expectedPromptName = `some-3095`;
            assert.strictEqual(getCleanPromptName(URI.file(`./${expectedPromptName}.prompt.md`)), expectedPromptName);
            assert.strictEqual(getCleanPromptName(URI.file('.github/copilot-instructions.md')), 'copilot-instructions');
            assert.strictEqual(getCleanPromptName(URI.file('/etc/prompts/my-prompt')), 'my-prompt');
            assert.strictEqual(getCleanPromptName(URI.file('../some-folder/frequent.txt')), 'frequent.txt');
            assert.strictEqual(getCleanPromptName(URI.parse('untitled:Untitled-1')), 'Untitled-1');
        });
    });
    suite('isPromptOrInstructionsFile', () => {
        test('returns `true` for prompt files', () => {
            assert(isPromptOrInstructionsFile(URI.file('/path/to/my-prompt.prompt.md')));
            assert(isPromptOrInstructionsFile(URI.file('../common.prompt.md')));
            assert(isPromptOrInstructionsFile(URI.file(`./some-38294.prompt.md`)));
            assert(isPromptOrInstructionsFile(URI.file('.github/copilot-instructions.md')));
        });
        test('returns `false` for non-prompt files', () => {
            assert(!isPromptOrInstructionsFile(URI.file('/path/to/my-prompt.prompt.md1')));
            assert(!isPromptOrInstructionsFile(URI.file('../common.md')));
            assert(!isPromptOrInstructionsFile(URI.file(`./some-2530.txt`)));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9wcm9tcHRTeW50YXgvY29uZmlnL2NvbnN0YW50cy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUMvSCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN6RyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFHOUQsS0FBSyxDQUFDLGtCQUFrQixFQUFFLEdBQUcsRUFBRTtJQUM5Qix1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7UUFDaEMsSUFBSSxDQUFDLDZCQUE2QixFQUFFLEdBQUcsRUFBRTtZQUN4QyxNQUFNLENBQUMsV0FBVyxDQUNqQixrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLDhCQUE4QixDQUFDLENBQUMsRUFDNUQsV0FBVyxDQUNYLENBQUM7WUFFRixNQUFNLENBQUMsV0FBVyxDQUNqQixrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUMsRUFDbkQsUUFBUSxDQUNSLENBQUM7WUFFRixNQUFNLGtCQUFrQixHQUFHLFdBQVcsQ0FBQztZQUN2QyxNQUFNLENBQUMsV0FBVyxDQUNqQixrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssa0JBQWtCLFlBQVksQ0FBQyxDQUFDLEVBQ2pFLGtCQUFrQixDQUNsQixDQUFDO1lBRUYsTUFBTSxDQUFDLFdBQVcsQ0FDakIsa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDLEVBQy9ELHNCQUFzQixDQUN0QixDQUFDO1lBRUYsTUFBTSxDQUFDLFdBQVcsQ0FDakIsa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLEVBQ3RELFdBQVcsQ0FDWCxDQUFDO1lBRUYsTUFBTSxDQUFDLFdBQVcsQ0FDakIsa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLEVBQzNELGNBQWMsQ0FDZCxDQUFDO1lBRUYsTUFBTSxDQUFDLFdBQVcsQ0FDakIsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEVBQ3BELFlBQVksQ0FDWixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssQ0FBQyw0QkFBNEIsRUFBRSxHQUFHLEVBQUU7UUFDeEMsSUFBSSxDQUFDLGlDQUFpQyxFQUFFLEdBQUcsRUFBRTtZQUM1QyxNQUFNLENBQ0wsMEJBQTBCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQ3BFLENBQUM7WUFFRixNQUFNLENBQ0wsMEJBQTBCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQzNELENBQUM7WUFFRixNQUFNLENBQ0wsMEJBQTBCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQzlELENBQUM7WUFFRixNQUFNLENBQ0wsMEJBQTBCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDLENBQ3ZFLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxzQ0FBc0MsRUFBRSxHQUFHLEVBQUU7WUFDakQsTUFBTSxDQUNMLENBQUMsMEJBQTBCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQ3RFLENBQUM7WUFFRixNQUFNLENBQ0wsQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQ3JELENBQUM7WUFFRixNQUFNLENBQ0wsQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FDeEQsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9