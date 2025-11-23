/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ok, strictEqual } from 'assert';
import { dedupeRules, isPowerShell } from '../../browser/runInTerminalHelpers.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
suite('isPowerShell', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('PowerShell executables', () => {
        test('should detect powershell.exe', () => {
            ok(isPowerShell('powershell.exe', 1 /* OperatingSystem.Windows */));
            ok(isPowerShell('powershell', 3 /* OperatingSystem.Linux */));
        });
        test('should detect pwsh.exe', () => {
            ok(isPowerShell('pwsh.exe', 1 /* OperatingSystem.Windows */));
            ok(isPowerShell('pwsh', 3 /* OperatingSystem.Linux */));
        });
        test('should detect powershell-preview', () => {
            ok(isPowerShell('powershell-preview.exe', 1 /* OperatingSystem.Windows */));
            ok(isPowerShell('powershell-preview', 3 /* OperatingSystem.Linux */));
        });
        test('should detect pwsh-preview', () => {
            ok(isPowerShell('pwsh-preview.exe', 1 /* OperatingSystem.Windows */));
            ok(isPowerShell('pwsh-preview', 3 /* OperatingSystem.Linux */));
        });
    });
    suite('PowerShell with full paths', () => {
        test('should detect Windows PowerShell with full path', () => {
            ok(isPowerShell('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', 1 /* OperatingSystem.Windows */));
        });
        test('should detect PowerShell Core with full path', () => {
            ok(isPowerShell('C:\\Program Files\\PowerShell\\7\\pwsh.exe', 1 /* OperatingSystem.Windows */));
        });
        test('should detect PowerShell on Linux/macOS with full path', () => {
            ok(isPowerShell('/usr/bin/pwsh', 3 /* OperatingSystem.Linux */));
        });
        test('should detect PowerShell preview with full path', () => {
            ok(isPowerShell('/opt/microsoft/powershell/7-preview/pwsh-preview', 3 /* OperatingSystem.Linux */));
        });
        test('should detect nested path with powershell', () => {
            ok(isPowerShell('/some/deep/path/to/powershell.exe', 1 /* OperatingSystem.Windows */));
        });
    });
    suite('Case sensitivity', () => {
        test('should detect PowerShell regardless of case', () => {
            ok(isPowerShell('PowerShell.exe', 1 /* OperatingSystem.Windows */));
            ok(isPowerShell('POWERSHELL.EXE', 1 /* OperatingSystem.Windows */));
            ok(isPowerShell('Pwsh.exe', 1 /* OperatingSystem.Windows */));
        });
    });
    suite('Non-PowerShell shells', () => {
        test('should not detect bash', () => {
            ok(!isPowerShell('bash', 3 /* OperatingSystem.Linux */));
        });
        test('should not detect zsh', () => {
            ok(!isPowerShell('zsh', 3 /* OperatingSystem.Linux */));
        });
        test('should not detect sh', () => {
            ok(!isPowerShell('sh', 3 /* OperatingSystem.Linux */));
        });
        test('should not detect fish', () => {
            ok(!isPowerShell('fish', 3 /* OperatingSystem.Linux */));
        });
        test('should not detect cmd.exe', () => {
            ok(!isPowerShell('cmd.exe', 1 /* OperatingSystem.Windows */));
        });
        test('should not detect command.com', () => {
            ok(!isPowerShell('command.com', 1 /* OperatingSystem.Windows */));
        });
        test('should not detect dash', () => {
            ok(!isPowerShell('dash', 3 /* OperatingSystem.Linux */));
        });
        test('should not detect tcsh', () => {
            ok(!isPowerShell('tcsh', 3 /* OperatingSystem.Linux */));
        });
        test('should not detect csh', () => {
            ok(!isPowerShell('csh', 3 /* OperatingSystem.Linux */));
        });
    });
    suite('Non-PowerShell shells with full paths', () => {
        test('should not detect bash with full path', () => {
            ok(!isPowerShell('/bin/bash', 3 /* OperatingSystem.Linux */));
        });
        test('should not detect zsh with full path', () => {
            ok(!isPowerShell('/usr/bin/zsh', 3 /* OperatingSystem.Linux */));
        });
        test('should not detect cmd.exe with full path', () => {
            ok(!isPowerShell('C:\\Windows\\System32\\cmd.exe', 1 /* OperatingSystem.Windows */));
        });
        test('should not detect git bash', () => {
            ok(!isPowerShell('C:\\Program Files\\Git\\bin\\bash.exe', 1 /* OperatingSystem.Windows */));
        });
    });
    suite('Edge cases', () => {
        test('should handle empty string', () => {
            ok(!isPowerShell('', 1 /* OperatingSystem.Windows */));
        });
        test('should handle paths with spaces', () => {
            ok(isPowerShell('C:\\Program Files\\PowerShell\\7\\pwsh.exe', 1 /* OperatingSystem.Windows */));
            ok(!isPowerShell('C:\\Program Files\\Git\\bin\\bash.exe', 1 /* OperatingSystem.Windows */));
        });
        test('should not match partial strings', () => {
            ok(!isPowerShell('notpowershell', 3 /* OperatingSystem.Linux */));
            ok(!isPowerShell('powershellish', 3 /* OperatingSystem.Linux */));
            ok(!isPowerShell('mypwsh', 3 /* OperatingSystem.Linux */));
            ok(!isPowerShell('pwshell', 3 /* OperatingSystem.Linux */));
        });
        test('should handle strings containing powershell but not as basename', () => {
            ok(!isPowerShell('/powershell/bin/bash', 3 /* OperatingSystem.Linux */));
            ok(!isPowerShell('/usr/pwsh/bin/zsh', 3 /* OperatingSystem.Linux */));
            ok(!isPowerShell('C:\\powershell\\cmd.exe', 1 /* OperatingSystem.Windows */));
        });
        test('should handle special characters in path', () => {
            ok(isPowerShell('/path/with-dashes/pwsh.exe', 1 /* OperatingSystem.Windows */));
            ok(isPowerShell('/path/with_underscores/powershell', 3 /* OperatingSystem.Linux */));
            ok(isPowerShell('C:\\path\\with spaces\\pwsh.exe', 1 /* OperatingSystem.Windows */));
        });
        test('should handle relative paths', () => {
            ok(isPowerShell('./powershell.exe', 1 /* OperatingSystem.Windows */));
            ok(isPowerShell('../bin/pwsh', 3 /* OperatingSystem.Linux */));
            ok(isPowerShell('bin/powershell', 3 /* OperatingSystem.Linux */));
        });
        test('should not match similar named tools', () => {
            ok(!isPowerShell('powertool', 3 /* OperatingSystem.Linux */));
            ok(!isPowerShell('shell', 3 /* OperatingSystem.Linux */));
            ok(!isPowerShell('power', 3 /* OperatingSystem.Linux */));
            ok(!isPowerShell('pwshconfig', 3 /* OperatingSystem.Linux */));
        });
    });
});
suite('dedupeRules', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    function createMockRule(sourceText) {
        return {
            regex: new RegExp(sourceText),
            regexCaseInsensitive: new RegExp(sourceText, 'i'),
            sourceText,
            sourceTarget: 2 /* ConfigurationTarget.USER */,
            isDefaultRule: false
        };
    }
    function createMockResult(result, reason, rule) {
        return {
            result,
            reason,
            rule
        };
    }
    test('should return empty array for empty input', () => {
        const result = dedupeRules([]);
        strictEqual(result.length, 0);
    });
    test('should return same array when no duplicates exist', () => {
        const result = dedupeRules([
            createMockResult('approved', 'approved by echo rule', createMockRule('echo')),
            createMockResult('approved', 'approved by ls rule', createMockRule('ls'))
        ]);
        strictEqual(result.length, 2);
        strictEqual(result[0].rule?.sourceText, 'echo');
        strictEqual(result[1].rule?.sourceText, 'ls');
    });
    test('should deduplicate rules with same sourceText', () => {
        const result = dedupeRules([
            createMockResult('approved', 'approved by echo rule', createMockRule('echo')),
            createMockResult('approved', 'approved by echo rule again', createMockRule('echo')),
            createMockResult('approved', 'approved by ls rule', createMockRule('ls'))
        ]);
        strictEqual(result.length, 2);
        strictEqual(result[0].rule?.sourceText, 'echo');
        strictEqual(result[1].rule?.sourceText, 'ls');
    });
    test('should preserve first occurrence when deduplicating', () => {
        const result = dedupeRules([
            createMockResult('approved', 'first echo rule', createMockRule('echo')),
            createMockResult('approved', 'second echo rule', createMockRule('echo'))
        ]);
        strictEqual(result.length, 1);
        strictEqual(result[0].reason, 'first echo rule');
    });
    test('should filter out results without rules', () => {
        const result = dedupeRules([
            createMockResult('noMatch', 'no rule applied'),
            createMockResult('approved', 'approved by echo rule', createMockRule('echo')),
            createMockResult('denied', 'denied without rule')
        ]);
        strictEqual(result.length, 1);
        strictEqual(result[0].rule?.sourceText, 'echo');
    });
    test('should handle mix of rules and no-rule results with duplicates', () => {
        const result = dedupeRules([
            createMockResult('approved', 'approved by echo rule', createMockRule('echo')),
            createMockResult('noMatch', 'no rule applied'),
            createMockResult('approved', 'approved by echo rule again', createMockRule('echo')),
            createMockResult('approved', 'approved by ls rule', createMockRule('ls')),
            createMockResult('denied', 'denied without rule')
        ]);
        strictEqual(result.length, 2);
        strictEqual(result[0].rule?.sourceText, 'echo');
        strictEqual(result[1].rule?.sourceText, 'ls');
    });
    test('should handle multiple duplicates of same rule', () => {
        const result = dedupeRules([
            createMockResult('approved', 'npm rule 1', createMockRule('npm')),
            createMockResult('approved', 'npm rule 2', createMockRule('npm')),
            createMockResult('approved', 'npm rule 3', createMockRule('npm')),
            createMockResult('approved', 'git rule', createMockRule('git'))
        ]);
        strictEqual(result.length, 2);
        strictEqual(result[0].rule?.sourceText, 'npm');
        strictEqual(result[0].reason, 'npm rule 1');
        strictEqual(result[1].rule?.sourceText, 'git');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuSW5UZXJtaW5hbEhlbHBlcnMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdEFnZW50VG9vbHMvdGVzdC9icm93c2VyL3J1bkluVGVybWluYWxIZWxwZXJzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDekMsT0FBTyxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVsRixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUl0RyxLQUFLLENBQUMsY0FBYyxFQUFFLEdBQUcsRUFBRTtJQUMxQix1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLEVBQUU7UUFDcEMsSUFBSSxDQUFDLDhCQUE4QixFQUFFLEdBQUcsRUFBRTtZQUN6QyxFQUFFLENBQUMsWUFBWSxDQUFDLGdCQUFnQixrQ0FBMEIsQ0FBQyxDQUFDO1lBQzVELEVBQUUsQ0FBQyxZQUFZLENBQUMsWUFBWSxnQ0FBd0IsQ0FBQyxDQUFDO1FBQ3ZELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHdCQUF3QixFQUFFLEdBQUcsRUFBRTtZQUNuQyxFQUFFLENBQUMsWUFBWSxDQUFDLFVBQVUsa0NBQTBCLENBQUMsQ0FBQztZQUN0RCxFQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sZ0NBQXdCLENBQUMsQ0FBQztRQUNqRCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxrQ0FBa0MsRUFBRSxHQUFHLEVBQUU7WUFDN0MsRUFBRSxDQUFDLFlBQVksQ0FBQyx3QkFBd0Isa0NBQTBCLENBQUMsQ0FBQztZQUNwRSxFQUFFLENB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