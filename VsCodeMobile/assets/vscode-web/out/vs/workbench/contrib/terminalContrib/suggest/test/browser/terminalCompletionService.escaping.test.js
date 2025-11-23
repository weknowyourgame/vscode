/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { escapeTerminalCompletionLabel } from '../../browser/terminalCompletionService.js';
import { strict as assert } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
suite('escapeTerminalCompletionLabel', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    const shellType = "bash" /* PosixShellType.Bash */;
    const pathSeparator = '/';
    const cases = [
        { char: '[', label: '[abc', expected: '\\[abc' },
        { char: ']', label: 'abc]', expected: 'abc\\]' },
        { char: '(', label: '(abc', expected: '\\(abc' },
        { char: ')', label: 'abc)', expected: 'abc\\)' },
        { char: '\'', label: `'abc`, expected: `\\'abc` },
        { char: '"', label: '"abc', expected: '\\"abc' },
        { char: '\\', label: 'abc\\', expected: 'abc\\\\' },
        { char: '`', label: '`abc', expected: '\\`abc' },
        { char: '*', label: '*abc', expected: '\\*abc' },
        { char: '?', label: '?abc', expected: '\\?abc' },
        { char: ';', label: ';abc', expected: '\\;abc' },
        { char: '&', label: '&abc', expected: '\\&abc' },
        { char: '|', label: '|abc', expected: '\\|abc' },
        { char: '<', label: '<abc', expected: '\\<abc' },
        { char: '>', label: '>abc', expected: '\\>abc' },
    ];
    for (const { char, label, expected } of cases) {
        test(`should escape '${char}' in "${label}"`, () => {
            const result = escapeTerminalCompletionLabel(label, shellType, pathSeparator);
            assert.equal(result, expected);
        });
    }
    test('should not escape when no special chars', () => {
        const result = escapeTerminalCompletionLabel('abc', shellType, pathSeparator);
        assert.equal(result, 'abc');
    });
    test('should not escape for PowerShell', () => {
        const result = escapeTerminalCompletionLabel('[abc', "pwsh" /* GeneralShellType.PowerShell */, pathSeparator);
        assert.equal(result, '[abc');
    });
    test('should not escape for CommandPrompt', () => {
        const result = escapeTerminalCompletionLabel('[abc', "cmd" /* WindowsShellType.CommandPrompt */, pathSeparator);
        assert.equal(result, '[abc');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21wbGV0aW9uU2VydmljZS5lc2NhcGluZy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9zdWdnZXN0L3Rlc3QvYnJvd3Nlci90ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLmVzY2FwaW5nLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFM0YsT0FBTyxFQUFFLE1BQU0sSUFBSSxNQUFNLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDMUMsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFdEcsS0FBSyxDQUFDLCtCQUErQixFQUFFLEdBQUcsRUFBRTtJQUMzQyx1Q0FBdUMsRUFBRSxDQUFDO0lBQzFDLE1BQU0sU0FBUyxtQ0FBeUMsQ0FBQztJQUN6RCxNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUM7SUFDMUIsTUFBTSxLQUFLLEdBQUc7UUFDYixFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFO1FBQ2hELEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUU7UUFDaEQsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRTtRQUNoRCxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFO1FBQ2hELEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUU7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