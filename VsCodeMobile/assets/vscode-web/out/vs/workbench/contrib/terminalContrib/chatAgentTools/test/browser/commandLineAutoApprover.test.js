/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { CommandLineAutoApprover } from '../../browser/commandLineAutoApprover.js';
import { ok, strictEqual } from 'assert';
suite('CommandLineAutoApprover', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let configurationService;
    let commandLineAutoApprover;
    let shell;
    let os;
    setup(() => {
        configurationService = new TestConfigurationService();
        instantiationService = workbenchInstantiationService({
            configurationService: () => configurationService
        }, store);
        shell = 'bash';
        os = 3 /* OperatingSystem.Linux */;
        commandLineAutoApprover = store.add(instantiationService.createInstance(CommandLineAutoApprover));
    });
    function setAutoApprove(value) {
        setConfig("chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */, value);
    }
    function setAutoApproveWithCommandLine(value) {
        setConfig("chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */, value);
    }
    function setConfig(key, value) {
        configurationService.setUserConfiguration(key, value);
        configurationService.onDidChangeConfigurationEmitter.fire({
            affectsConfiguration: () => true,
            affectedKeys: new Set([key]),
            source: 2 /* ConfigurationTarget.USER */,
            change: null,
        });
    }
    function isAutoApproved(commandLine) {
        return commandLineAutoApprover.isCommandAutoApproved(commandLine, shell, os).result === 'approved';
    }
    function isCommandLineAutoApproved(commandLine) {
        return commandLineAutoApprover.isCommandLineAutoApproved(commandLine).result === 'approved';
    }
    suite('autoApprove with allow patterns only', () => {
        test('should auto-approve exact command match', () => {
            setAutoApprove({
                'echo': true
            });
            ok(isAutoApproved('echo'));
        });
        test('should auto-approve command with arguments', () => {
            setAutoApprove({
                'echo': true
            });
            ok(isAutoApproved('echo hello world'));
        });
        test('should not auto-approve when there is no match', () => {
            setAutoApprove({
                'echo': true
            });
            ok(!isAutoApproved('ls'));
        });
        test('should not auto-approve partial command matches', () => {
            setAutoApprove({
                'echo': true
            });
            ok(!isAutoApproved('echotest'));
        });
        test('should handle multiple commands in autoApprove', () => {
            setAutoApprove({
                'echo': true,
                'ls': true,
                'pwd': true
            });
            ok(isAutoApproved('echo'));
            ok(isAutoApproved('ls -la'));
            ok(isAutoApproved('pwd'));
            ok(!isAutoApproved('rm'));
        });
    });
    suite('autoApprove with deny patterns only', () => {
        test('should deny commands in autoApprove', () => {
            setAutoApprove({
                'rm': false,
                'del': false
            });
            ok(!isAutoApproved('rm file.txt'));
            ok(!isAutoApproved('del file.txt'));
        });
        test('should not auto-approve safe commands when no allow patterns are present', () => {
            setAutoApprove({
                'rm': false
            });
            ok(!isAutoApproved('echo hello'));
            ok(!isAutoApproved('ls'));
        });
    });
    suite('autoApprove with mixed allow and deny patterns', () => {
        test('should deny commands set to false even if other commands are set to true', () => {
            setAutoApprove({
                'echo': true,
                'rm': false
            });
            ok(isAutoApproved('echo hello'));
            ok(!isAutoApproved('rm file.txt'));
        });
        test('should auto-approve allow patterns not set to false', () => {
            setAutoApprove({
                'echo': true,
                'ls': true,
                'pwd': true,
                'rm': false,
                'del': false
            });
            ok(isAutoApproved('echo'));
            ok(isAutoApproved('ls'));
            ok(isAutoApproved('pwd'));
            ok(!isAutoApproved('rm'));
            ok(!isAutoApproved('del'));
        });
    });
    suite('regex patterns', () => {
        test('should handle /.*/', () => {
            setAutoApprove({
                '/.*/': true,
            });
            ok(isAutoApproved('echo hello'));
        });
        test('should handle regex patterns in autoApprove', () => {
            setAutoApprove({
                '/^echo/': true,
                '/^ls/': true,
                'pwd': true
            });
            ok(isAutoApproved('echo hello'));
            ok(isAutoApproved('ls -la'));
            ok(isAutoApproved('pwd'));
            ok(!isAutoApproved('rm file'));
        });
        test('should handle regex patterns for deny', () => {
            setAutoApprove({
                'echo': true,
                'rm': true,
                '/^rm\\s+/': false,
                '/^del\\s+/': false
            });
            ok(isAutoApproved('echo hello'));
            ok(isAutoApproved('rm'));
            ok(!isAutoApproved('rm file.txt'));
            ok(!isAutoApproved('del file.txt'));
        });
        test('should handle complex regex patterns', () => {
            setAutoApprove({
                '/^(echo|ls|pwd)\\b/': true,
                '/^git (status|show\\b.*)$/': true,
                '/rm|del|kill/': false
            });
            ok(isAutoApproved('echo test'));
            ok(isAutoApproved('ls -la'));
            ok(isAutoApproved('pwd'));
            ok(isAutoApproved('git status'));
            ok(isAutoApproved('git show'));
            ok(isAutoApproved('git show HEAD'));
            ok(!isAutoApproved('rm file'));
            ok(!isAutoApproved('del file'));
            ok(!isAutoApproved('kill process'));
        });
        suite('flags', () => {
            test('should handle case-insensitive regex patterns with i flag', () => {
                setAutoApprove({
                    '/^echo/i': true,
                    '/^ls/i': true,
                    '/rm|del/i': false
                });
                ok(isAutoApproved('echo hello'));
                ok(isAutoApproved('ECHO hello'));
                ok(isAutoApproved('Echo hello'));
                ok(isAutoApproved('ls -la'));
                ok(isAutoApproved('LS -la'));
                ok(isAutoApproved('Ls -la'));
                ok(!isAutoApproved('rm file'));
                ok(!isAutoApproved('RM file'));
                ok(!isAutoApproved('del file'));
                ok(!isAutoApproved('DEL file'));
            });
            test('should handle multiple regex flags', () => {
                setAutoApprove({
                    '/^git\\s+/gim': true,
                    '/dangerous/gim': false
                });
                ok(isAutoApproved('git status'));
                ok(isAutoApproved('GIT status'));
                ok(isAutoApproved('Git status'));
                ok(!isAutoApproved('dangerous command'));
                ok(!isAutoApproved('DANGEROUS command'));
            });
            test('should handle various regex flags', () => {
                setAutoApprove({
                    '/^echo.*/s': true, // dotall flag
                    '/^git\\s+/i': true, // case-insensitive flag
                    '/rm|del/g': false // global flag
                });
                ok(isAutoApproved('echo hello\nworld'));
                ok(isAutoApproved('git status'));
                ok(isAutoApproved('GIT status'));
                ok(!isAutoApproved('rm file'));
                ok(!isAutoApproved('del file'));
            });
            test('should handle regex patterns without flags', () => {
                setAutoApprove({
                    '/^echo/': true,
                    '/rm|del/': false
                });
                ok(isAutoApproved('echo hello'));
                ok(!isAutoApproved('ECHO hello'), 'Should be case-sensitive without i flag');
                ok(!isAutoApproved('rm file'));
                ok(!isAutoApproved('RM file'), 'Should be case-sensitive without i flag');
            });
        });
    });
    suite('edge cases', () => {
        test('should handle empty autoApprove', () => {
            setAutoApprove({});
            ok(!isAutoApproved('echo hello'));
            ok(!isAutoApproved('ls'));
            ok(!isAutoApproved('rm file'));
        });
        test('should handle empty command strings', () => {
            setAutoApprove({
                'echo': true
            });
            ok(!isAutoApproved(''));
            ok(!isAutoApproved('   '));
        });
        test('should handle whitespace in commands', () => {
            setAutoApprove({
                'echo': true
            });
            ok(isAutoApproved('echo   hello   world'));
        });
        test('should be case-sensitive by default', () => {
            setAutoApprove({
                'echo': true
            });
            ok(isAutoApproved('echo hello'));
            ok(!isAutoApproved('ECHO hello'));
            ok(!isAutoApproved('Echo hello'));
        });
        // https://github.com/microsoft/vscode/issues/252411
        test('should handle string-based values with special regex characters', () => {
            setAutoApprove({
                'pwsh.exe -File D:\\foo.bar\\a-script.ps1': true
            });
            ok(isAutoApproved('pwsh.exe -File D:\\foo.bar\\a-script.ps1'));
            ok(isAutoApproved('pwsh.exe -File D:\\foo.bar\\a-script.ps1 -AnotherArg'));
        });
        test('should ignore the empty string key', () => {
            setAutoApprove({
                '': true
            });
            ok(!isAutoApproved('echo hello'));
        });
        test('should handle empty regex patterns that could cause endless loops', () => {
            setAutoApprove({
                '//': true,
                '/(?:)/': true,
                '/*/': true, // Invalid regex pattern
                '/.**/': true // Invalid regex pattern
            });
            // These patterns should not cause endless loops and should not match any commands
            // Invalid patterns should be handled gracefully and not match anything
            ok(!isAutoApproved('echo hello'));
            ok(!isAutoApproved('ls'));
            ok(!isAutoApproved(''));
        });
        test('should handle regex patterns that would cause endless loops', () => {
            setAutoApprove({
                '/a*/': true,
                '/b?/': true,
                '/(x|)*/': true,
                '/(?:)*/': true
            });
            // Commands should still work normally, endless loop patterns should be safely handled
            ok(!isAutoApproved('echo hello'));
            ok(!isAutoApproved('ls'));
            ok(!isAutoApproved('a'));
            ok(!isAutoApproved('b'));
        });
        test('should handle mixed valid and problematic regex patterns', () => {
            setAutoApprove({
                '/^echo/': true, // Valid pattern
                '//': true, // Empty pattern
                '/^ls/': true, // Valid pattern
                '/a*/': true, // Potential endless loop
                'pwd': true // Valid string pattern
            });
            ok(isAutoApproved('echo hello'));
            ok(isAutoApproved('ls -la'));
            ok(isAutoApproved('pwd'));
            ok(!isAutoApproved('rm file'));
        });
        test('should handle invalid regex patterns gracefully', () => {
            setAutoApprove({
                '/*/': true, // Invalid regex - nothing to repeat
                '/(?:+/': true, // Invalid regex - incomplete quantifier
                '/[/': true, // Invalid regex - unclosed character class
                '/^echo/': true, // Valid pattern
                'ls': true // Valid string pattern
            });
            // Valid patterns should still work
            ok(isAutoApproved('echo hello'));
            ok(isAutoApproved('ls -la'));
            // Invalid patterns should not match anything and not cause crashes
            ok(!isAutoApproved('random command'));
        });
    });
    suite('path-aware auto approval', () => {
        test('should handle path variations with forward slashes', () => {
            setAutoApprove({
                'bin/foo': true
            });
            // Should approve the exact match
            ok(isAutoApproved('bin/foo'));
            ok(isAutoApproved('bin/foo --arg'));
            // Should approve with Windows backslashes
            ok(isAutoApproved('bin\\foo'));
            ok(isAutoApproved('bin\\foo --arg'));
            // Should approve with current directory prefixes
            ok(isAutoApproved('./bin/foo'));
            ok(isAutoApproved('.\\bin/foo'));
            ok(isAutoApproved('./bin\\foo'));
            ok(isAutoApproved('.\\bin\\foo'));
            // Should not approve partial matches
            ok(!isAutoApproved('bin/foobar'));
            ok(!isAutoApproved('notbin/foo'));
        });
        test('should handle path variations with backslashes', () => {
            setAutoApprove({
                'bin\\script.bat': true
            });
            // Should approve the exact match
            ok(isAutoApproved('bin\\script.bat'));
            ok(isAutoApproved('bin\\script.bat --help'));
            // Should approve with forward slashes
            ok(isAutoApproved('bin/script.bat'));
            ok(isAutoApproved('bin/script.bat --help'));
            // Should approve with current directory prefixes
            ok(isAutoApproved('./bin\\script.bat'));
            ok(isAutoApproved('.\\bin\\script.bat'));
            ok(isAutoApproved('./bin/script.bat'));
            ok(isAutoApproved('.\\bin/script.bat'));
        });
        test('should handle deep paths', () => {
            setAutoApprove({
                'src/utils/helper.js': true
            });
            ok(isAutoApproved('src/utils/helper.js'));
            ok(isAutoApproved('src\\utils\\helper.js'));
            ok(isAutoApproved('src/utils\\helper.js'));
            ok(isAutoApproved('src\\utils/helper.js'));
            ok(isAutoApproved('./src/utils/helper.js'));
            ok(isAutoApproved('.\\src\\utils\\helper.js'));
        });
        test('should not treat non-paths as paths', () => {
            setAutoApprove({
                'echo': true, // Not a path
                'ls': true, // Not a path
                'git': true // Not a path
            });
            // These should work as normal command matching, not path matching
            ok(isAutoApproved('echo'));
            ok(isAutoApproved('ls'));
            ok(isAutoApproved('git'));
            // Should not be treated as paths, so these prefixes shouldn't work
            ok(!isAutoApproved('./echo'));
            ok(!isAutoApproved('.\\ls'));
        });
        test('should handle paths with mixed separators in config', () => {
            setAutoApprove({
                'bin/foo\\bar': true // Mixed separators in config
            });
            ok(isAutoApproved('bin/foo\\bar'));
            ok(isAutoApproved('bin\\foo/bar'));
            ok(isAutoApproved('bin/foo/bar'));
            ok(isAutoApproved('bin\\foo\\bar'));
            ok(isAutoApproved('./bin/foo\\bar'));
            ok(isAutoApproved('.\\bin\\foo\\bar'));
        });
        test('should work with command line auto approval for paths', () => {
            setAutoApproveWithCommandLine({
                'bin/deploy': { approve: true, matchCommandLine: true }
            });
            ok(isCommandLineAutoApproved('bin/deploy --prod'));
            ok(isCommandLineAutoApproved('bin\\deploy --prod'));
            ok(isCommandLineAutoApproved('./bin/deploy --prod'));
            ok(isCommandLineAutoApproved('.\\bin\\deploy --prod'));
        });
        test('should handle special characters in paths', () => {
            setAutoApprove({
                'bin/my-script.sh': true,
                'scripts/build_all.py': true,
                'tools/run (debug).exe': true
            });
            ok(isAutoApproved('bin/my-script.sh'));
            ok(isAutoApproved('bin\\my-script.sh'));
            ok(isAutoApproved('./bin/my-script.sh'));
            ok(isAutoApproved('scripts/build_all.py'));
            ok(isAutoApproved('scripts\\build_all.py'));
            ok(isAutoApproved('tools/run (debug).exe'));
            ok(isAutoApproved('tools\\run (debug).exe'));
        });
    });
    suite('PowerShell-specific commands', () => {
        setup(() => {
            shell = 'pwsh';
        });
        test('should handle Windows PowerShell commands', () => {
            setAutoApprove({
                'Get-ChildItem': true,
                'Get-Content': true,
                'Get-Location': true,
                'Remove-Item': false,
                'del': false
            });
            ok(isAutoApproved('Get-ChildItem'));
            ok(isAutoApproved('Get-Content file.txt'));
            ok(isAutoApproved('Get-Location'));
            ok(!isAutoApproved('Remove-Item file.txt'));
        });
        test('should handle ( prefixes', () => {
            setAutoApprove({
                'Get-Content': true
            });
            ok(isAutoApproved('Get-Content file.txt'));
            ok(isAutoApproved('(Get-Content file.txt'));
            ok(!isAutoApproved('[Get-Content'));
            ok(!isAutoApproved('foo'));
        });
        test('should be case-insensitive for PowerShell commands', () => {
            setAutoApprove({
                'Get-ChildItem': true,
                'Get-Content': true,
                'Remove-Item': false
            });
            ok(isAutoApproved('Get-ChildItem'));
            ok(isAutoApproved('get-childitem'));
            ok(isAutoApproved('GET-CHILDITEM'));
            ok(isAutoApproved('Get-childitem'));
            ok(isAutoApproved('get-ChildItem'));
            ok(isAutoApproved('Get-Content file.txt'));
            ok(isAutoApproved('get-content file.txt'));
            ok(isAutoApproved('GET-CONTENT file.txt'));
            ok(isAutoApproved('Get-content file.txt'));
            ok(!isAutoApproved('Remove-Item file.txt'));
            ok(!isAutoApproved('remove-item file.txt'));
            ok(!isAutoApproved('REMOVE-ITEM file.txt'));
            ok(!isAutoApproved('Remove-item file.txt'));
        });
        test('should be case-insensitive for PowerShell aliases', () => {
            setAutoApprove({
                'ls': true,
                'dir': true,
                'rm': false,
                'del': false
            });
            // Test case-insensitive matching for aliases
            ok(isAutoApproved('ls'));
            ok(isAutoApproved('LS'));
            ok(isAutoApproved('Ls'));
            ok(isAutoApproved('dir'));
            ok(isAutoApproved('DIR'));
            ok(isAutoApproved('Dir'));
            ok(!isAutoApproved('rm file.txt'));
            ok(!isAutoApproved('RM file.txt'));
            ok(!isAutoApproved('Rm file.txt'));
            ok(!isAutoApproved('del file.txt'));
            ok(!isAutoApproved('DEL file.txt'));
            ok(!isAutoApproved('Del file.txt'));
        });
        test('should be case-insensitive with regex patterns', () => {
            setAutoApprove({
                '/^Get-/': true,
                '/Remove-Item|rm/': false
            });
            ok(isAutoApproved('Get-ChildItem'));
            ok(isAutoApproved('get-childitem'));
            ok(isAutoApproved('GET-PROCESS'));
            ok(isAutoApproved('Get-Location'));
            ok(!isAutoApproved('Remove-Item file.txt'));
            ok(!isAutoApproved('remove-item file.txt'));
            ok(!isAutoApproved('rm file.txt'));
            ok(!isAutoApproved('RM file.txt'));
        });
        test('should handle case-insensitive PowerShell commands on different OS', () => {
            setAutoApprove({
                'Get-Process': true,
                'Stop-Process': false
            });
            for (const currnetOS of [1 /* OperatingSystem.Windows */, 3 /* OperatingSystem.Linux */, 2 /* OperatingSystem.Macintosh */]) {
                os = currnetOS;
                ok(isAutoApproved('Get-Process'), `os=${os}`);
                ok(isAutoApproved('get-process'), `os=${os}`);
                ok(isAutoApproved('GET-PROCESS'), `os=${os}`);
                ok(!isAutoApproved('Stop-Process'), `os=${os}`);
                ok(!isAutoApproved('stop-process'), `os=${os}`);
            }
        });
    });
    suite('isCommandLineAutoApproved - matchCommandLine functionality', () => {
        test('should auto-approve command line patterns with matchCommandLine: true', () => {
            setAutoApproveWithCommandLine({
                'echo': { approve: true, matchCommandLine: true }
            });
            ok(isCommandLineAutoApproved('echo hello'));
            ok(isCommandLineAutoApproved('echo test && ls'));
        });
        test('should not auto-approve regular patterns with isCommandLineAutoApproved', () => {
            setAutoApprove({
                'echo': true
            });
            // Regular patterns should not be matched by isCommandLineAutoApproved
            ok(!isCommandLineAutoApproved('echo hello'));
        });
        test('should handle regex patterns with matchCommandLine: true', () => {
            setAutoApproveWithCommandLine({
                '/echo.*world/': { approve: true, matchCommandLine: true }
            });
            ok(isCommandLineAutoApproved('echo hello world'));
            ok(!isCommandLineAutoApproved('echo hello'));
        });
        test('should handle case-insensitive regex with matchCommandLine: true', () => {
            setAutoApproveWithCommandLine({
                '/echo/i': { approve: true, matchCommandLine: true }
            });
            ok(isCommandLineAutoApproved('echo hello'));
            ok(isCommandLineAutoApproved('ECHO hello'));
            ok(isCommandLineAutoApproved('Echo hello'));
        });
        test('should handle complex command line patterns', () => {
            setAutoApproveWithCommandLine({
                '/^npm run build/': { approve: true, matchCommandLine: true },
                '/\.ps1/i': { approve: true, matchCommandLine: true }
            });
            ok(isCommandLineAutoApproved('npm run build --production'));
            ok(isCommandLineAutoApproved('powershell -File script.ps1'));
            ok(isCommandLineAutoApproved('pwsh -File SCRIPT.PS1'));
            ok(!isCommandLineAutoApproved('npm install'));
        });
        test('should return false for empty command line', () => {
            setAutoApproveWithCommandLine({
                'echo': { approve: true, matchCommandLine: true }
            });
            ok(!isCommandLineAutoApproved(''));
            ok(!isCommandLineAutoApproved('   '));
        });
        test('should handle mixed configuration with matchCommandLine entries', () => {
            setAutoApproveWithCommandLine({
                'echo': true, // Regular pattern
                'ls': { approve: true, matchCommandLine: true }, // Command line pattern
                'rm': { approve: true, matchCommandLine: false } // Explicit regular pattern
            });
            // Only the matchCommandLine: true entry should work with isCommandLineAutoApproved
            ok(isCommandLineAutoApproved('ls -la'));
            ok(!isCommandLineAutoApproved('echo hello'));
            ok(!isCommandLineAutoApproved('rm file.txt'));
        });
        test('should handle deny patterns with matchCommandLine: true', () => {
            setAutoApproveWithCommandLine({
                'echo': { approve: true, matchCommandLine: true },
                '/dangerous/': { approve: false, matchCommandLine: true }
            });
            ok(isCommandLineAutoApproved('echo hello'));
            ok(!isCommandLineAutoApproved('echo dangerous command'));
            ok(!isCommandLineAutoApproved('dangerous operation'));
        });
        test('should prioritize deny list over allow list for command line patterns', () => {
            setAutoApproveWithCommandLine({
                '/echo/': { approve: true, matchCommandLine: true },
                '/echo.*dangerous/': { approve: false, matchCommandLine: true }
            });
            ok(isCommandLineAutoApproved('echo hello'));
            ok(!isCommandLineAutoApproved('echo dangerous command'));
        });
        test('should handle complex deny patterns with matchCommandLine', () => {
            setAutoApproveWithCommandLine({
                'npm': { approve: true, matchCommandLine: true },
                '/npm.*--force/': { approve: false, matchCommandLine: true },
                '/\.ps1.*-ExecutionPolicy/i': { approve: false, matchCommandLine: true }
            });
            ok(isCommandLineAutoApproved('npm install'));
            ok(isCommandLineAutoApproved('npm run build'));
            ok(!isCommandLineAutoApproved('npm install --force'));
            ok(!isCommandLineAutoApproved('powershell -File script.ps1 -ExecutionPolicy Bypass'));
        });
        test('should handle empty regex patterns with matchCommandLine that could cause endless loops', () => {
            setAutoApproveWithCommandLine({
                '//': { approve: true, matchCommandLine: true },
                '/(?:)/': { approve: true, matchCommandLine: true },
                '/*/': { approve: true, matchCommandLine: true }, // Invalid regex pattern
                '/.**/': { approve: true, matchCommandLine: true } // Invalid regex pattern
            });
            // These patterns should not cause endless loops and should not match any commands
            // Invalid patterns should be handled gracefully and not match anything
            ok(!isCommandLineAutoApproved('echo hello'));
            ok(!isCommandLineAutoApproved('ls'));
            ok(!isCommandLineAutoApproved(''));
        });
        test('should handle regex patterns with matchCommandLine that would cause endless loops', () => {
            setAutoApproveWithCommandLine({
                '/a*/': { approve: true, matchCommandLine: true },
                '/b?/': { approve: true, matchCommandLine: true },
                '/(x|)*/': { approve: true, matchCommandLine: true },
                '/(?:)*/': { approve: true, matchCommandLine: true }
            });
            // Commands should still work normally, endless loop patterns should be safely handled
            ok(!isCommandLineAutoApproved('echo hello'));
            ok(!isCommandLineAutoApproved('ls'));
            ok(!isCommandLineAutoApproved('a'));
            ok(!isCommandLineAutoApproved('b'));
        });
        test('should handle mixed valid and problematic regex patterns with matchCommandLine', () => {
            setAutoApproveWithCommandLine({
                '/^echo/': { approve: true, matchCommandLine: true }, // Valid pattern
                '//': { approve: true, matchCommandLine: true }, // Empty pattern
                '/^ls/': { approve: true, matchCommandLine: true }, // Valid pattern
                '/a*/': { approve: true, matchCommandLine: true }, // Potential endless loop
                'pwd': { approve: true, matchCommandLine: true } // Valid string pattern
            });
            ok(isCommandLineAutoApproved('echo hello'));
            ok(isCommandLineAutoApproved('ls -la'));
            ok(isCommandLineAutoApproved('pwd'));
            ok(!isCommandLineAutoApproved('rm file'));
        });
        test('should handle invalid regex patterns with matchCommandLine gracefully', () => {
            setAutoApproveWithCommandLine({
                '/*/': { approve: true, matchCommandLine: true }, // Invalid regex - nothing to repeat
                '/(?:+/': { approve: true, matchCommandLine: true }, // Invalid regex - incomplete quantifier
                '/[/': { approve: true, matchCommandLine: true }, // Invalid regex - unclosed character class
                '/^echo/': { approve: true, matchCommandLine: true }, // Valid pattern
                'ls': { approve: true, matchCommandLine: true } // Valid string pattern
            });
            // Valid patterns should still work
            ok(isCommandLineAutoApproved('echo hello'));
            ok(isCommandLineAutoApproved('ls -la'));
            // Invalid patterns should not match anything and not cause crashes
            ok(!isCommandLineAutoApproved('random command'));
        });
    });
    suite('reasons', () => {
        function getCommandReason(command) {
            return commandLineAutoApprover.isCommandAutoApproved(command, shell, os).reason;
        }
        function getCommandLineReason(commandLine) {
            return commandLineAutoApprover.isCommandLineAutoApproved(commandLine).reason;
        }
        suite('command', () => {
            test('approved', () => {
                setAutoApprove({ echo: true });
                strictEqual(getCommandReason('echo hello'), `Command 'echo hello' is approved by allow list rule: echo`);
            });
            test('not approved', () => {
                setAutoApprove({ echo: false });
                strictEqual(getCommandReason('echo hello'), `Command 'echo hello' is denied by deny list rule: echo`);
            });
            test('no match', () => {
                setAutoApprove({});
                strictEqual(getCommandReason('echo hello'), `Command 'echo hello' has no matching auto approve entries`);
            });
        });
        suite('command line', () => {
            test('approved', () => {
                setAutoApproveWithCommandLine({ echo: { approve: true, matchCommandLine: true } });
                strictEqual(getCommandLineReason('echo hello'), `Command line 'echo hello' is approved by allow list rule: echo`);
            });
            test('not approved', () => {
                setAutoApproveWithCommandLine({ echo: { approve: false, matchCommandLine: true } });
                strictEqual(getCommandLineReason('echo hello'), `Command line 'echo hello' is denied by deny list rule: echo`);
            });
            test('no match', () => {
                setAutoApproveWithCommandLine({});
                strictEqual(getCommandLineReason('echo hello'), `Command line 'echo hello' has no matching auto approve entries`);
            });
        });
    });
    suite('isDefaultRule logic', () => {
        function getIsDefaultRule(command) {
            return commandLineAutoApprover.isCommandAutoApproved(command, shell, os).rule?.isDefaultRule;
        }
        function getCommandLineIsDefaultRule(commandLine) {
            return commandLineAutoApprover.isCommandLineAutoApproved(commandLine).rule?.isDefaultRule;
        }
        function setAutoApproveWithDefaults(userConfig, defaultConfig) {
            // Set up mock configuration with default values
            configurationService.setUserConfiguration("chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */, userConfig);
            // Mock the inspect method to return default values
            const originalInspect = configurationService.inspect;
            const originalGetValue = configurationService.getValue;
            configurationService.inspect = (key) => {
                if (key === "chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */) {
                    return {
                        default: { value: defaultConfig },
                        user: { value: userConfig },
                        workspace: undefined,
                        workspaceFolder: undefined,
                        application: undefined,
                        policy: undefined,
                        memory: undefined,
                        value: { ...defaultConfig, ...userConfig }
                    };
                }
                return originalInspect.call(configurationService, key);
            };
            configurationService.getValue = (key) => {
                if (key === "chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */) {
                    return { ...defaultConfig, ...userConfig };
                }
                return originalGetValue.call(configurationService, key);
            };
            // Trigger configuration update
            configurationService.onDidChangeConfigurationEmitter.fire({
                affectsConfiguration: () => true,
                affectedKeys: new Set(["chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */]),
                source: 2 /* ConfigurationTarget.USER */,
                change: null,
            });
        }
        function setAutoApproveWithDefaultsCommandLine(userConfig, defaultConfig) {
            // Set up mock configuration with default values for command line rules
            configurationService.setUserConfiguration("chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */, userConfig);
            // Mock the inspect method to return default values
            const originalInspect = configurationService.inspect;
            const originalGetValue = configurationService.getValue;
            configurationService.inspect = (key) => {
                if (key === "chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */) {
                    return {
                        default: { value: defaultConfig },
                        user: { value: userConfig },
                        workspace: undefined,
                        workspaceFolder: undefined,
                        application: undefined,
                        policy: undefined,
                        memory: undefined,
                        value: { ...defaultConfig, ...userConfig }
                    };
                }
                return originalInspect.call(configurationService, key);
            };
            configurationService.getValue = (key) => {
                if (key === "chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */) {
                    return { ...defaultConfig, ...userConfig };
                }
                return originalGetValue.call(configurationService, key);
            };
            // Trigger configuration update
            configurationService.onDidChangeConfigurationEmitter.fire({
                affectsConfiguration: () => true,
                affectedKeys: new Set(["chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */]),
                source: 2 /* ConfigurationTarget.USER */,
                change: null,
            });
        }
        test('should correctly identify default rules vs user-defined rules', () => {
            setAutoApproveWithDefaults({ 'echo': true, 'ls': true, 'pwd': false }, { 'echo': true, 'cat': true });
            strictEqual(getIsDefaultRule('echo hello'), true, 'echo is in both default and user config with same value - should be marked as default');
            strictEqual(getIsDefaultRule('ls -la'), false, 'ls is only in user config - should be marked as user-defined');
            strictEqual(getIsDefaultRule('pwd'), false, 'pwd is only in user config - should be marked as user-defined');
            strictEqual(getIsDefaultRule('cat file.txt'), true, 'cat is in both default and user config with same value - should be marked as default');
        });
        test('should mark as default when command is only in default config but not in user config', () => {
            setAutoApproveWithDefaults({ 'echo': true, 'ls': true }, // User config (cat is NOT here)
            { 'echo': true, 'cat': true } // Default config (cat IS here)
            );
            // Test that merged config includes all commands
            strictEqual(commandLineAutoApprover.isCommandAutoApproved('echo', shell, os).result, 'approved', 'echo should be approved');
            strictEqual(commandLineAutoApprover.isCommandAutoApproved('ls', shell, os).result, 'approved', 'ls should be approved');
            // cat should be approved because it's in the merged config
            const catResult = commandLineAutoApprover.isCommandAutoApproved('cat', shell, os);
            strictEqual(catResult.result, 'approved', 'cat should be approved from default config');
            // cat should be marked as default rule since it comes from default config only
            strictEqual(catResult.rule?.isDefaultRule, true, 'cat is only in default config, not in user config - should be marked as default');
        });
        test('should handle default rules with different values', () => {
            setAutoApproveWithDefaults({ 'echo': true, 'rm': true }, { 'echo': false, 'rm': true });
            strictEqual(getIsDefaultRule('echo hello'), false, 'echo has different values in default vs user - should be marked as user-defined');
            strictEqual(getIsDefaultRule('rm file.txt'), true, 'rm has same value in both - should be marked as default');
        });
        test('should handle regex patterns as default rules', () => {
            setAutoApproveWithDefaults({ '/^git/': true, '/^npm/': false }, { '/^git/': true, '/^docker/': true });
            strictEqual(getIsDefaultRule('git status'), true, 'git pattern matches default - should be marked as default');
            strictEqual(getIsDefaultRule('npm install'), false, 'npm pattern is user-only - should be marked as user-defined');
        });
        test('should handle mixed string and regex patterns', () => {
            setAutoApproveWithDefaults({ 'echo': true, '/^ls/': false }, { 'echo': true, 'cat': true });
            strictEqual(getIsDefaultRule('echo hello'), true, 'String pattern matching default');
            strictEqual(getIsDefaultRule('ls -la'), false, 'Regex pattern user-defined');
        });
        test('should handle command line rules with isDefaultRule', () => {
            setAutoApproveWithDefaultsCommandLine({
                'echo': { approve: true, matchCommandLine: true },
                'ls': { approve: false, matchCommandLine: true }
            }, {
                'echo': { approve: true, matchCommandLine: true },
                'cat': { approve: true, matchCommandLine: true }
            });
            strictEqual(getCommandLineIsDefaultRule('echo hello world'), true, 'echo matches default config exactly using structural equality - should be marked as default');
            strictEqual(getCommandLineIsDefaultRule('ls -la'), false, 'ls is user-defined only - should be marked as user-defined');
        });
        test('should handle command line rules with different matchCommandLine values', () => {
            setAutoApproveWithDefaultsCommandLine({
                'echo': { approve: true, matchCommandLine: true },
                'ls': { approve: true, matchCommandLine: false }
            }, {
                'echo': { approve: true, matchCommandLine: false },
                'ls': { approve: true, matchCommandLine: false }
            });
            strictEqual(getCommandLineIsDefaultRule('echo hello'), false, 'echo has different matchCommandLine value - should be user-defined');
            strictEqual(getCommandLineIsDefaultRule('ls -la'), undefined, 'ls matches exactly - should be default (but won\'t match command line check since matchCommandLine is false)');
        });
        test('should handle boolean vs object format consistency', () => {
            setAutoApproveWithDefaultsCommandLine({
                'echo': true,
                'ls': { approve: true, matchCommandLine: true }
            }, {
                'echo': true,
                'ls': { approve: true, matchCommandLine: true }
            });
            strictEqual(getIsDefaultRule('echo hello'), true, 'Boolean format matching - should be default');
            strictEqual(getCommandLineIsDefaultRule('ls -la'), true, 'Object format matching using structural equality - should be default');
        });
        test('should return undefined for noMatch cases', () => {
            setAutoApproveWithDefaults({ 'echo': true }, { 'cat': true });
            strictEqual(getIsDefaultRule('unknown-command'), undefined, 'Command that matches neither user nor default config');
            strictEqual(getCommandLineIsDefaultRule('unknown-command'), undefined, 'Command that matches neither user nor default config');
        });
        test('should handle empty configurations', () => {
            setAutoApproveWithDefaults({}, {});
            strictEqual(getIsDefaultRule('echo hello'), undefined);
            strictEqual(getCommandLineIsDefaultRule('echo hello'), undefined);
        });
        test('should handle only default config with no user overrides', () => {
            setAutoApproveWithDefaults({}, { 'echo': true, 'ls': false });
            strictEqual(getIsDefaultRule('echo hello'), true, 'Commands in default config should be marked as default rules even with empty user config');
            strictEqual(getIsDefaultRule('ls -la'), true, 'Commands in default config should be marked as default rules even with empty user config');
        });
        test('should handle complex nested object rules', () => {
            setAutoApproveWithDefaultsCommandLine({
                'npm': { approve: true, matchCommandLine: true },
                'git': { approve: false, matchCommandLine: false }
            }, {
                'npm': { approve: true, matchCommandLine: true },
                'docker': { approve: true, matchCommandLine: true }
            });
            strictEqual(getCommandLineIsDefaultRule('npm install'), true, 'npm matches default exactly using structural equality - should be default');
            strictEqual(getCommandLineIsDefaultRule('git status'), undefined, 'git is user-defined - should be user-defined (but won\'t match command line since matchCommandLine is false)');
        });
        test('should handle PowerShell case-insensitive matching with defaults', () => {
            shell = 'pwsh';
            os = 1 /* OperatingSystem.Windows */;
            setAutoApproveWithDefaults({ 'Get-Process': true }, { 'Get-Process': true });
            strictEqual(getIsDefaultRule('Get-Process'), true, 'Case-insensitive PowerShell command matching default');
            strictEqual(getIsDefaultRule('get-process'), true, 'Case-insensitive PowerShell command matching default');
            strictEqual(getIsDefaultRule('GET-PROCESS'), true, 'Case-insensitive PowerShell command matching default');
        });
        test('should use structural equality for object comparison', () => {
            // Test that objects with same content but different instances are treated as equal
            const userConfig = { 'test': { approve: true, matchCommandLine: true } };
            const defaultConfig = { 'test': { approve: true, matchCommandLine: true } };
            setAutoApproveWithDefaultsCommandLine(userConfig, defaultConfig);
            strictEqual(getCommandLineIsDefaultRule('test command'), true, 'Even though userConfig and defaultConfig are different object instances, they have the same structure and values, so should be considered default');
        });
        test('should detect structural differences in objects', () => {
            const userConfig = { 'test': { approve: true, matchCommandLine: true } };
            const defaultConfig = { 'test': { approve: true, matchCommandLine: false } };
            setAutoApproveWithDefaultsCommandLine(userConfig, defaultConfig);
            strictEqual(getCommandLineIsDefaultRule('test command'), false, 'Objects have different matchCommandLine values, so should be user-defined');
        });
        test('should handle mixed types correctly', () => {
            const userConfig = {
                'cmd1': true,
                'cmd2': { approve: false, matchCommandLine: true }
            };
            const defaultConfig = {
                'cmd1': true,
                'cmd2': { approve: false, matchCommandLine: true }
            };
            setAutoApproveWithDefaultsCommandLine(userConfig, defaultConfig);
            strictEqual(getIsDefaultRule('cmd1 arg'), true, 'Boolean type should match default');
            strictEqual(getCommandLineIsDefaultRule('cmd2 arg'), true, 'Object type should match default using structural equality (even though it\'s a deny rule)');
        });
    });
    suite('ignoreDefaultAutoApproveRules', () => {
        function setAutoApproveWithDefaults(userConfig, defaultConfig) {
            // Set up mock configuration with default values
            configurationService.setUserConfiguration("chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */, userConfig);
            // Mock the inspect method to return default values
            const originalInspect = configurationService.inspect;
            const originalGetValue = configurationService.getValue;
            configurationService.inspect = (key) => {
                if (key === "chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */) {
                    return {
                        default: { value: defaultConfig },
                        user: { value: userConfig },
                        workspace: undefined,
                        workspaceFolder: undefined,
                        application: undefined,
                        policy: undefined,
                        memory: undefined,
                        value: { ...defaultConfig, ...userConfig }
                    };
                }
                return originalInspect.call(configurationService, key);
            };
            configurationService.getValue = (key) => {
                if (key === "chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */) {
                    return { ...defaultConfig, ...userConfig };
                }
                return originalGetValue.call(configurationService, key);
            };
            // Trigger configuration update
            configurationService.onDidChangeConfigurationEmitter.fire({
                affectsConfiguration: () => true,
                affectedKeys: new Set(["chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */]),
                source: 2 /* ConfigurationTarget.USER */,
                change: null,
            });
        }
        function setIgnoreDefaultAutoApproveRules(value) {
            setConfig("chat.tools.terminal.ignoreDefaultAutoApproveRules" /* TerminalChatAgentToolsSettingId.IgnoreDefaultAutoApproveRules */, value);
        }
        test('should include default rules when ignoreDefaultAutoApproveRules is false (default behavior)', () => {
            setAutoApproveWithDefaults({ 'ls': true }, { 'echo': true, 'cat': true });
            setIgnoreDefaultAutoApproveRules(false);
            ok(isAutoApproved('ls -la'), 'User-defined rule should work');
            ok(isAutoApproved('echo hello'), 'Default rule should work when not ignored');
            ok(isAutoApproved('cat file.txt'), 'Default rule should work when not ignored');
        });
        test('should exclude default rules when ignoreDefaultAutoApproveRules is true', () => {
            setAutoApproveWithDefaults({ 'ls': true }, { 'echo': true, 'cat': true });
            setIgnoreDefaultAutoApproveRules(true);
            ok(isAutoApproved('ls -la'), 'User-defined rule should still work');
            ok(!isAutoApproved('echo hello'), 'Default rule should be ignored');
            ok(!isAutoApproved('cat file.txt'), 'Default rule should be ignored');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZExpbmVBdXRvQXBwcm92ZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdEFnZW50VG9vbHMvdGVzdC9icm93c2VyL2NvbW1hbmRMaW5lQXV0b0FwcHJvdmVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sa0ZBQWtGLENBQUM7QUFFNUgsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFckcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFbkYsT0FBTyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFFekMsS0FBSyxDQUFDLHlCQUF5QixFQUFFLEdBQUcsRUFBRTtJQUNyQyxNQUFNLEtBQUssR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBRXhELElBQUksb0JBQTJDLENBQUM7SUFDaEQsSUFBSSxvQkFBOEMsQ0FBQztJQUVuRCxJQUFJLHVCQUFnRCxDQUFDO0lBQ3JELElBQUksS0FBYSxDQUFDO0lBQ2xCLElBQUksRUFBbUIsQ0FBQztJQUV4QixLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1Ysb0JBQW9CLEdBQUcsSUFBSSx3QkFBd0IsRUFBRSxDQUFDO1FBQ3RELG9CQUFvQixHQUFHLDZCQUE2QixDQUFDO1lBQ3BELG9CQUFvQixFQUFFLEdBQUcsRUFBRSxDQUFDLG9CQUFvQjtTQUNoRCxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRVYsS0FBSyxHQUFHLE1BQU0sQ0FBQztRQUNmLEVBQUUsZ0NBQXdCLENBQUM7UUFDM0IsdUJBQXVCLEdBQUcsS0FBSyxD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