/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual } from 'assert';
import { OS } from '../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { collapseTildePath, sanitizeCwd, escapeNonWindowsPath } from '../../common/terminalEnvironment.js';
suite('terminalEnvironment', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('collapseTildePath', () => {
        test('should return empty string for a falsy path', () => {
            strictEqual(collapseTildePath('', '/foo', '/'), '');
            strictEqual(collapseTildePath(undefined, '/foo', '/'), '');
        });
        test('should return path for a falsy user home', () => {
            strictEqual(collapseTildePath('/foo', '', '/'), '/foo');
            strictEqual(collapseTildePath('/foo', undefined, '/'), '/foo');
        });
        test('should not collapse when user home isn\'t present', () => {
            strictEqual(collapseTildePath('/foo', '/bar', '/'), '/foo');
            strictEqual(collapseTildePath('C:\\foo', 'C:\\bar', '\\'), 'C:\\foo');
        });
        test('should collapse with Windows separators', () => {
            strictEqual(collapseTildePath('C:\\foo\\bar', 'C:\\foo', '\\'), '~\\bar');
            strictEqual(collapseTildePath('C:\\foo\\bar', 'C:\\foo\\', '\\'), '~\\bar');
            strictEqual(collapseTildePath('C:\\foo\\bar\\baz', 'C:\\foo\\', '\\'), '~\\bar\\baz');
            strictEqual(collapseTildePath('C:\\foo\\bar\\baz', 'C:\\foo', '\\'), '~\\bar\\baz');
        });
        test('should collapse mixed case with Windows separators', () => {
            strictEqual(collapseTildePath('c:\\foo\\bar', 'C:\\foo', '\\'), '~\\bar');
            strictEqual(collapseTildePath('C:\\foo\\bar\\baz', 'c:\\foo', '\\'), '~\\bar\\baz');
        });
        test('should collapse with Posix separators', () => {
            strictEqual(collapseTildePath('/foo/bar', '/foo', '/'), '~/bar');
            strictEqual(collapseTildePath('/foo/bar', '/foo/', '/'), '~/bar');
            strictEqual(collapseTildePath('/foo/bar/baz', '/foo', '/'), '~/bar/baz');
            strictEqual(collapseTildePath('/foo/bar/baz', '/foo/', '/'), '~/bar/baz');
        });
    });
    suite('sanitizeCwd', () => {
        if (OS === 1 /* OperatingSystem.Windows */) {
            test('should make the Windows drive letter uppercase', () => {
                strictEqual(sanitizeCwd('c:\\foo\\bar'), 'C:\\foo\\bar');
            });
        }
        test('should remove any wrapping quotes', () => {
            strictEqual(sanitizeCwd('\'/foo/bar\''), '/foo/bar');
            strictEqual(sanitizeCwd('"/foo/bar"'), '/foo/bar');
        });
    });
    suite('escapeNonWindowsPath', () => {
        test('should escape for bash/sh/zsh shells', () => {
            strictEqual(escapeNonWindowsPath('/foo/bar', "bash" /* PosixShellType.Bash */), '\'/foo/bar\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz', "bash" /* PosixShellType.Bash */), '\'/foo/bar\\\'baz\'');
            strictEqual(escapeNonWindowsPath('/foo/bar"baz', "bash" /* PosixShellType.Bash */), '\'/foo/bar"baz\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz"qux', "bash" /* PosixShellType.Bash */), '$\'/foo/bar\\\'baz"qux\'');
            strictEqual(escapeNonWindowsPath('/foo/bar', "sh" /* PosixShellType.Sh */), '\'/foo/bar\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz', "sh" /* PosixShellType.Sh */), '\'/foo/bar\\\'baz\'');
            strictEqual(escapeNonWindowsPath('/foo/bar', "zsh" /* PosixShellType.Zsh */), '\'/foo/bar\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz', "zsh" /* PosixShellType.Zsh */), '\'/foo/bar\\\'baz\'');
        });
        test('should escape for git bash', () => {
            strictEqual(escapeNonWindowsPath('/foo/bar', "gitbash" /* WindowsShellType.GitBash */), '\'/foo/bar\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz', "gitbash" /* WindowsShellType.GitBash */), '\'/foo/bar\\\'baz\'');
            strictEqual(escapeNonWindowsPath('/foo/bar"baz', "gitbash" /* WindowsShellType.GitBash */), '\'/foo/bar"baz\'');
        });
        test('should escape for fish shell', () => {
            strictEqual(escapeNonWindowsPath('/foo/bar', "fish" /* PosixShellType.Fish */), '\'/foo/bar\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz', "fish" /* PosixShellType.Fish */), '\'/foo/bar\\\'baz\'');
            strictEqual(escapeNonWindowsPath('/foo/bar"baz', "fish" /* PosixShellType.Fish */), '\'/foo/bar"baz\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz"qux', "fish" /* PosixShellType.Fish */), '"/foo/bar\'baz\\"qux"');
        });
        test('should escape for PowerShell', () => {
            strictEqual(escapeNonWindowsPath('/foo/bar', "pwsh" /* GeneralShellType.PowerShell */), '\'/foo/bar\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz', "pwsh" /* GeneralShellType.PowerShell */), '\'/foo/bar\'\'baz\'');
            strictEqual(escapeNonWindowsPath('/foo/bar"baz', "pwsh" /* GeneralShellType.PowerShell */), '\'/foo/bar"baz\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz"qux', "pwsh" /* GeneralShellType.PowerShell */), '"/foo/bar\'baz`"qux"');
        });
        test('should default to POSIX escaping for unknown shells', () => {
            strictEqual(escapeNonWindowsPath('/foo/bar'), '\'/foo/bar\'');
            strictEqual(escapeNonWindowsPath('/foo/bar\'baz'), '\'/foo/bar\\\'baz\'');
        });
        test('should remove dangerous characters', () => {
            strictEqual(escapeNonWindowsPath('/foo/bar$(echo evil)', "bash" /* PosixShellType.Bash */), '\'/foo/bar(echo evil)\'');
            strictEqual(escapeNonWindowsPath('/foo/bar`whoami`', "bash" /* PosixShellType.Bash */), '\'/foo/barwhoami\'');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxFbnZpcm9ubWVudC50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3Rlcm1pbmFsL3Rlc3QvY29tbW9uL3Rlcm1pbmFsRW52aXJvbm1lbnQudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3JDLE9BQU8sRUFBbUIsRUFBRSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRzNHLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7SUFDakMsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFO1FBQy9CLElBQUksQ0FBQyw2Q0FBNkMsRUFBRSxHQUFHLEVBQUU7WUFDeEQsV0FBVyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDcEQsV0FBVyxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDNUQsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsMENBQTBDLEVBQUUsR0FBRyxFQUFFO1lBQ3JELFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ3hELFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxFQUFFLE1B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