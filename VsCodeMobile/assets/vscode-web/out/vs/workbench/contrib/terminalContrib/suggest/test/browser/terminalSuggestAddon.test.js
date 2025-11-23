/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isInlineCompletionSupported } from '../../browser/terminalSuggestAddon.js';
suite('Terminal Suggest Addon - Inline Completion, Shell Type Support', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('should return true for supported shell types', () => {
        strictEqual(isInlineCompletionSupported("bash" /* PosixShellType.Bash */), true);
        strictEqual(isInlineCompletionSupported("zsh" /* PosixShellType.Zsh */), true);
        strictEqual(isInlineCompletionSupported("fish" /* PosixShellType.Fish */), true);
        strictEqual(isInlineCompletionSupported("pwsh" /* GeneralShellType.PowerShell */), true);
        strictEqual(isInlineCompletionSupported("gitbash" /* WindowsShellType.GitBash */), true);
    });
    test('should return false for unsupported shell types', () => {
        strictEqual(isInlineCompletionSupported("nu" /* GeneralShellType.NuShell */), false);
        strictEqual(isInlineCompletionSupported("julia" /* GeneralShellType.Julia */), false);
        strictEqual(isInlineCompletionSupported("node" /* GeneralShellType.Node */), false);
        strictEqual(isInlineCompletionSupported("python" /* GeneralShellType.Python */), false);
        strictEqual(isInlineCompletionSupported("sh" /* PosixShellType.Sh */), false);
        strictEqual(isInlineCompletionSupported("csh" /* PosixShellType.Csh */), false);
        strictEqual(isInlineCompletionSupported("ksh" /* PosixShellType.Ksh */), false);
        strictEqual(isInlineCompletionSupported("cmd" /* WindowsShellType.CommandPrompt */), false);
        strictEqual(isInlineCompletionSupported("wsl" /* WindowsShellType.Wsl */), false);
        strictEqual(isInlineCompletionSupported("python" /* GeneralShellType.Python */), false);
        strictEqual(isInlineCompletionSupported(undefined), false);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTdWdnZXN0QWRkb24udGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC90ZXN0L2Jyb3dzZXIvdGVybWluYWxTdWdnZXN0QWRkb24udGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3JDLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRXRHLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRXBGLEtBQUssQ0FBQyxnRUFBZ0UsRUFBRSxHQUFHLEVBQUU7SUFDNUUsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMsOENBQThDLEVBQUUsR0FBRyxFQUFFO1FBQ3pELFdBQVcsQ0FBQywyQkFBMkIsa0NBQXFCLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDcEUsV0FBVyxDQUFDLDJCQUEyQixnQ0FBb0IsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNuRSxXQUFXLENBQUMsMkJBQTJCLGtDQUFxQixFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BFLFdBQVcsQ0FBQywyQkFBMkIsMENBQTZCLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDNUUsV0FBVyxDQUFDLDJCQUEyQiwwQ0FBMEIsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMxRSxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxpREFBaUQsRUFBRSxHQUFHLEVBQUU7UUFDNUQsV0FBVyxDQUFDLDJCQUEyQixxQ0FBMEIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMxRSxXQUFXLENBQUMsMkJBQTJCLHNDQUF3QixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3hFLFdBQVcsQ0FBQywyQkFBMkIsb0NBQXVCLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdkUsV0FBVyxDQUFDLDJCQUEyQix3Q0FBeUIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN6RSxXQUFXLENBQUMsMkJBQTJCLDhCQUFtQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ25FLFdBQVcsQ0FBQywyQkFBMkIsZ0NBQW9CLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDcEUsV0FBVyxDQUFDLDJCQUEyQixnQ0FBb0IsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwRSxXQUFXLENBQUMsMkJBQTJCLDRDQUFnQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2hGLFdBQVcsQ0FBQywyQkFBMkIsa0NBQXNCLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdEUsV0FBVyxDQUFDLDJCQUEyQix3Q0FBeUIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN6RSxXQUFXLENBQUMsMkJBQTJCLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUQsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9