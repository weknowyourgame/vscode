/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { detectsCommonPromptPattern } from '../../browser/executeStrategy/executeStrategy.js';
suite('Execute Strategy - Prompt Detection', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('detectsCommonPromptPattern should detect PowerShell prompts', () => {
        strictEqual(detectsCommonPromptPattern('PS C:\\>').detected, true);
        strictEqual(detectsCommonPromptPattern('PS C:\\Windows\\System32>').detected, true);
        strictEqual(detectsCommonPromptPattern('PS C:\\Users\\test> ').detected, true);
    });
    test('detectsCommonPromptPattern should detect Command Prompt', () => {
        strictEqual(detectsCommonPromptPattern('C:\\>').detected, true);
        strictEqual(detectsCommonPromptPattern('C:\\Windows\\System32>').detected, true);
        strictEqual(detectsCommonPromptPattern('D:\\test> ').detected, true);
    });
    test('detectsCommonPromptPattern should detect Bash prompts', () => {
        strictEqual(detectsCommonPromptPattern('user@host:~$ ').detected, true);
        strictEqual(detectsCommonPromptPattern('$ ').detected, true);
        strictEqual(detectsCommonPromptPattern('[user@host ~]$ ').detected, true);
    });
    test('detectsCommonPromptPattern should detect root prompts', () => {
        strictEqual(detectsCommonPromptPattern('root@host:~# ').detected, true);
        strictEqual(detectsCommonPromptPattern('# ').detected, true);
        strictEqual(detectsCommonPromptPattern('[root@host ~]# ').detected, true);
    });
    test('detectsCommonPromptPattern should detect Python REPL', () => {
        strictEqual(detectsCommonPromptPattern('>>> ').detected, true);
        strictEqual(detectsCommonPromptPattern('>>>').detected, true);
    });
    test('detectsCommonPromptPattern should detect starship prompts', () => {
        strictEqual(detectsCommonPromptPattern('~ \u276f ').detected, true);
        strictEqual(detectsCommonPromptPattern('/path/to/project \u276f').detected, true);
    });
    test('detectsCommonPromptPattern should detect generic prompts', () => {
        strictEqual(detectsCommonPromptPattern('test> ').detected, true);
        strictEqual(detectsCommonPromptPattern('someprompt% ').detected, true);
    });
    test('detectsCommonPromptPattern should handle multiline content', () => {
        const multilineContent = `command output line 1
command output line 2
user@host:~$ `;
        strictEqual(detectsCommonPromptPattern(multilineContent).detected, true);
    });
    test('detectsCommonPromptPattern should reject non-prompt content', () => {
        strictEqual(detectsCommonPromptPattern('just some output').detected, false);
        strictEqual(detectsCommonPromptPattern('error: command not found').detected, false);
        strictEqual(detectsCommonPromptPattern('').detected, false);
        strictEqual(detectsCommonPromptPattern('   ').detected, false);
    });
    test('detectsCommonPromptPattern should handle edge cases', () => {
        strictEqual(detectsCommonPromptPattern('output\n\n\n').detected, false);
        strictEqual(detectsCommonPromptPattern('\n\n$ \n\n').detected, true); // prompt with surrounding whitespace
        strictEqual(detectsCommonPromptPattern('output\nPS C:\\> ').detected, true); // prompt at end after output
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlY3V0ZVN0cmF0ZWd5LnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL3Rlc3QvYnJvd3Nlci9leGVjdXRlU3RyYXRlZ3kudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3JDLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRTlGLEtBQUssQ0FBQyxxQ0FBcUMsRUFBRSxHQUFHLEVBQUU7SUFDakQsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMsNkRBQTZELEVBQUUsR0FBRyxFQUFFO1FBQ3hFLFdBQVcsQ0FBQywwQkFBMEIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbkUsV0FBVyxDQUFDLDBCQUEwQixDQUFDLDJCQUEyQixDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BGLFdBQVcsQ0FBQywwQkFBMEIsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNoRixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx5REFBeUQsRUFBRSxHQUFHLEVBQUU7UUFDcEUsV0FBVyxDQUFDLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoRSxXQUFXLENBQUMsMEJBQTBCLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDakYsV0FBVyxDQUFDLDBCQUEwQixDQUFDLFlBQVks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