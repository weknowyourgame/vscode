/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { deepStrictEqual } from 'assert';
import { Schemas } from '../../../../../../base/common/network.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ITreeSitterLibraryService } from '../../../../../../editor/common/services/treeSitter/treeSitterLibraryService.js';
import { FileService } from '../../../../../../platform/files/common/fileService.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import { TreeSitterLibraryService } from '../../../../../services/treeSitter/browser/treeSitterLibraryService.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { TestIPCFileSystemProvider } from '../../../../../test/electron-browser/workbenchTestServices.js';
import { TreeSitterCommandParser } from '../../browser/treeSitterCommandParser.js';
suite('TreeSitterCommandParser', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let parser;
    setup(() => {
        const fileService = store.add(new FileService(new NullLogService()));
        const fileSystemProvider = new TestIPCFileSystemProvider();
        store.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
        instantiationService = workbenchInstantiationService({
            fileService: () => fileService,
        }, store);
        const treeSitterLibraryService = store.add(instantiationService.createInstance(TreeSitterLibraryService));
        treeSitterLibraryService.isTest = true;
        instantiationService.stub(ITreeSitterLibraryService, treeSitterLibraryService);
        parser = store.add(instantiationService.createInstance(TreeSitterCommandParser));
    });
    suite('extractSubCommands', () => {
        suite('bash', () => {
            async function t(commandLine, expectedCommands) {
                const result = await parser.extractSubCommands("bash" /* TreeSitterCommandParserLanguage.Bash */, commandLine);
                deepStrictEqual(result, expectedCommands);
            }
            test('simple commands', () => t('ls -la', ['ls -la']));
            test('commands with &&', () => t('echo hello && ls -la', ['echo hello', 'ls -la']));
            test('commands with ||', () => t('test -f file.txt || touch file.txt', ['test -f file.txt', 'touch file.txt']));
            test('commands with semicolons', () => t('cd /tmp; ls; pwd', ['cd /tmp', 'ls', 'pwd']));
            test('pipe chains', () => t('cat file.txt | grep pattern | sort | uniq', ['cat file.txt', 'grep pattern', 'sort', 'uniq']));
            test('commands with subshells', () => t('echo $(date +%Y) && ls', ['echo $(date +%Y)', 'date +%Y', 'ls']));
            test('complex quoting', () => t('echo "hello && world" && echo \'test\'', ['echo "hello && world"', 'echo \'test\'']));
            test('escaped characters', () => t('echo hello\\ world && ls', ['echo hello\\ world', 'ls']));
            test('background commands', () => t('sleep 10 & echo done', ['sleep 10', 'echo done']));
            test('variable assignments', () => t('VAR=value command1 && echo $VAR', ['VAR=value command1', 'echo $VAR']));
            test('redirections', () => t('echo hello > file.txt && cat < file.txt', ['echo hello', 'cat']));
            test('arithmetic expansion', () => t('echo $((1 + 2)) && ls', ['echo $((1 + 2))', 'ls']));
            test('nested command substitution', () => t('echo $(cat $(echo file.txt)) && ls', ['echo $(cat $(echo file.txt))', 'cat $(echo file.txt)', 'echo file.txt', 'ls']));
            test('mixed operators', () => t('cmd1 && cmd2 || cmd3; cmd4 | cmd5 & cmd6', ['cmd1', 'cmd2', 'cmd3', 'cmd4', 'cmd5', 'cmd6']));
            test('parameter expansion', () => t('echo ${VAR:-default} && echo ${#VAR}', ['echo ${VAR:-default}', 'echo ${#VAR}']));
            test('process substitution', () => t('diff <(sort file1) <(sort file2) && echo done', ['diff <(sort file1) <(sort file2)', 'sort file1', 'sort file2', 'echo done']));
            test('brace expansion', () => t('echo {a,b,c}.txt && ls', ['echo {a,b,c}.txt', 'ls']));
            test('tilde expansion', () => t('cd ~/Documents && ls ~/.bashrc', ['cd ~/Documents', 'ls ~/.bashrc']));
            suite('control flow and structures', () => {
                test('if-then-else', () => t('if [ -f file.txt ]; then cat file.txt; else echo "not found"; fi', ['cat file.txt', 'echo "not found"']));
                test('simple iteration', () => t('for file in *.txt; do cat "$file"; done', ['cat "$file"']));
                test('function declaration and call', () => t('function test_func() { echo "inside function"; } && test_func', ['echo "inside function"', 'test_func']));
                test('heredoc with commands', () => t('cat << EOF\nhello\nworld\nEOF\necho done', ['cat', 'echo done']));
                test('while loop', () => t('while read line; do echo "$line"; done < file.txt', ['read line', 'echo "$line"']));
                test('case statement', () => t('case $var in pattern1) echo "match1" ;; pattern2) echo "match2" ;; esac', ['echo "match1"', 'echo "match2"']));
                test('until loop', () => t('until [ -f ready.txt ]; do sleep 1; done && echo ready', ['sleep 1', 'echo ready']));
                test('nested conditionals', () => t('if [ -f file ]; then if [ -r file ]; then cat file; fi; fi', ['cat file']));
                test('test command alternatives', () => t('[[ -f file ]] && cat file || echo missing', ['cat file', 'echo missing']));
            });
            suite('edge cases', () => {
                test('malformed syntax', () => t('echo "unclosed quote && ls', ['echo']));
                test('unmatched parentheses', () => t('echo $(missing closing && ls', ['echo $(missing closing && ls', 'missing closing', 'ls']));
                test('very long command lines', () => t('echo ' + 'a'.repeat(10000) + ' && ls', ['echo ' + 'a'.repeat(10000), 'ls']));
                test('special characters', () => t('echo "πλαςε 测试 🚀" && ls', ['echo "πλαςε 测试 🚀"', 'ls']));
                test('multiline with continuations', () => t('echo hello \\\n&& echo world \\\n&& ls', ['echo hello', 'echo world', 'ls']));
                test('commands with comments', () => t('echo hello # this is a comment\nls # another comment', ['echo hello', 'ls']));
                test('empty command in chain', () => t('echo hello && && echo world', ['echo hello', 'echo world']));
                test('trailing operators', () => t('echo hello &&', ['echo hello', '']));
                test('only operators', () => t('&& || ;', []));
                test('nested quotes', () => t('echo "outer \"inner\" outer" && ls', ['echo "outer \"inner\" outer"', 'ls']));
                test('incomplete escape sequences', () => t('echo hello\\ && ls', ['echo hello\\ ', 'ls']));
                test('mixed quote types', () => t('echo "hello \`world\`" && echo \'test\'', ['echo "hello \`world\`"', 'world', 'echo \'test\'']));
                test('deeply nested structures', () => t('echo $(echo $(echo $(echo nested))) && ls', ['echo $(echo $(echo $(echo nested)))', 'echo $(echo $(echo nested))', 'echo $(echo nested)', 'echo nested', 'ls']));
                test('unicode command names', () => t('测试命令 && echo done', ['测试命令', 'echo done']));
                test('multi-line', () => t('echo a\necho b', ['echo a', 'echo b']));
            });
            // TODO: These should be common but the pwsh grammar doesn't handle && yet https://github.com/microsoft/vscode/issues/272704
            suite('real-world scenarios', () => {
                test('complex Docker commands', () => t('docker run -it --rm -v $(pwd):/app ubuntu:latest bash -c "cd /app && npm install && npm test"', ['docker run -it --rm -v $(pwd):/app ubuntu:latest bash -c "cd /app && npm install && npm test"', 'pwd']));
                test('Git workflow commands', () => t('git add . && git commit -m "Update feature" && git push origin main', [
                    'git add .',
                    'git commit -m "Update feature"',
                    'git push origin main'
                ]));
                test('npm/yarn workflow commands', () => t('npm ci && npm run build && npm test && npm run lint', [
                    'npm ci',
                    'npm run build',
                    'npm test',
                    'npm run lint'
                ]));
                test('build system commands', () => t('make clean && make -j$(nproc) && make install PREFIX=/usr/local', [
                    'make clean',
                    'make -j$(nproc)',
                    'nproc',
                    'make install PREFIX=/usr/local'
                ]));
                test('deployment script', () => t('rsync -avz --delete src/ user@server:/path/ && ssh user@server "systemctl restart service" && echo "Deployed successfully"', [
                    'rsync -avz --delete src/ user@server:/path/',
                    'ssh user@server "systemctl restart service"',
                    'echo "Deployed successfully"'
                ]));
                test('database backup script', () => t('mysqldump -u user -p database > backup_$(date +%Y%m%d).sql && gzip backup_$(date +%Y%m%d).sql && echo "Backup complete"', [
                    'mysqldump -u user -p database',
                    'date +%Y%m%d',
                    'gzip backup_$(date +%Y%m%d).sql',
                    'date +%Y%m%d',
                    'echo "Backup complete"'
                ]));
                test('log analysis pipeline', () => t('tail -f /var/log/app.log | grep ERROR | while read line; do echo "$(date): $line" >> error.log; done', [
                    'tail -f /var/log/app.log',
                    'grep ERROR',
                    'read line',
                    'echo "$(date): $line"',
                    'date'
                ]));
                test('conditional installation', () => t('which docker || (curl -fsSL https://get.docker.com | sh && systemctl enable docker) && docker --version', [
                    'which docker',
                    'curl -fsSL https://get.docker.com',
                    'sh',
                    'systemctl enable docker',
                    'docker --version'
                ]));
            });
        });
        suite('pwsh', () => {
            async function t(commandLine, expectedCommands) {
                const result = await parser.extractSubCommands("powershell" /* TreeSitterCommandParserLanguage.PowerShell */, commandLine);
                deepStrictEqual(result, expectedCommands);
            }
            test('simple commands', () => t('Get-ChildItem -Path C:\\', ['Get-ChildItem -Path C:\\']));
            test('commands with semicolons', () => t('Get-Date; Get-Location; Write-Host "done"', ['Get-Date', 'Get-Location', 'Write-Host "done"']));
            test('pipeline commands', () => t('Get-Process | Where-Object {$_.CPU -gt 100} | Sort-Object CPU', ['Get-Process ', 'Where-Object {$_.CPU -gt 100} ', 'Sort-Object CPU']));
            test('command substitution', () => t('Write-Host $(Get-Date) ; Get-Location', ['Write-Host $(Get-Date)', 'Get-Date', 'Get-Location']));
            test('complex parameters', () => t('Get-ChildItem -Path "C:\\Program Files" -Recurse -Include "*.exe"', ['Get-ChildItem -Path "C:\\Program Files" -Recurse -Include "*.exe"']));
            test('splatting', () => t('$params = @{Path="C:\\"; Recurse=$true}; Get-ChildItem @params', ['Get-ChildItem @params']));
            test('here-strings', () => t('Write-Host @"\nhello\nworld\n"@ ; Get-Date', ['Write-Host @"\nhello\nworld\n"@', 'Get-Date']));
            test('method calls', () => t('"hello".ToUpper() ; Get-Date', ['Get-Date']));
            test('complex quoting', () => t('Write-Host "She said `"Hello`"" ; Write-Host \'Single quotes\'', ['Write-Host "She said `"Hello`""', 'Write-Host \'Single quotes\'']));
            test('array operations', () => t('$arr = @(1,2,3); $arr | ForEach-Object { $_ * 2 }', ['ForEach-Object { $_ * 2 }']));
            test('hashtable operations', () => t('$hash = @{key="value"}; Write-Host $hash.key', ['Write-Host $hash.key']));
            test('type casting', () => t('[int]"123" + [int]"456" ; Write-Host "done"', ['Write-Host "done"']));
            test('regex operations', () => t('"hello world" -match "w.*d" ; Get-Date', ['Get-Date']));
            test('comparison operators', () => t('5 -gt 3 -and "hello" -like "h*" ; Write-Host "true"', ['Write-Host "true"']));
            test('null-conditional operators', () => t('$obj?.Property?.SubProperty ; Get-Date', ['Get-Date']));
            test('string interpolation', () => t('$name="World"; "Hello $name" ; Get-Date', ['Get-Date']));
            test('expandable strings', () => t('$var="test"; "Value: $($var.ToUpper())" ; Get-Date', ['Get-Date']));
            suite('Control flow and structures', () => {
                test('logical and', () => t('Test-Path "file.txt" -and Get-Content "file.txt"', ['Test-Path "file.txt" -and Get-Content "file.txt"']));
                test('foreach with script block', () => t('ForEach-Object { Write-Host $_.Name } ; Get-Date', ['ForEach-Object { Write-Host $_.Name }', 'Write-Host $_.Name', 'Get-Date']));
                test('if-else', () => t('if (Test-Path "file.txt") { Get-Content "file.txt" } else { Write-Host "not found" }', ['Test-Path "file.txt"', 'Get-Content "file.txt"', 'Write-Host "not found"']));
                test('error handling', () => t('try { Get-Content "file.txt" } catch { Write-Error "failed" }', ['Get-Content "file.txt"', 'Write-Error "failed"']));
                test('switch statement', () => t('switch ($var) { 1 { "one" } 2 { "two" } default { "other" } } ; Get-Date', ['Get-Date']));
                test('do-while loop', () => t('do { Write-Host $i; $i++ } while ($i -lt 5) ; Get-Date', ['Write-Host $i', 'Get-Date']));
                test('for loop', () => t('for ($i=0; $i -lt 5; $i++) { Write-Host $i } ; Get-Date', ['Write-Host $i', 'Get-Date']));
                test('foreach loop with range', () => t('foreach ($i in 1..5) { Write-Host $i } ; Get-Date', ['1..5', 'Write-Host $i', 'Get-Date']));
                test('break and continue', () => t('while ($true) { if ($condition) { break } ; Write-Host "running" } ; Get-Date', ['Write-Host "running"', 'Get-Date']));
                test('nested try-catch-finally', () => t('try { try { Get-Content "file" } catch { throw } } catch { Write-Error "outer" } finally { Write-Host "cleanup" }', ['Get-Content "file"', 'Write-Error "outer"', 'Write-Host "cleanup"']));
                test('parallel processing', () => t('1..10 | ForEach-Object -Parallel { Start-Sleep 1; Write-Host $_ } ; Get-Date', ['1..10 ', 'ForEach-Object -Parallel { Start-Sleep 1; Write-Host $_ }', 'Start-Sleep 1', 'Write-Host $_', 'Get-Date']));
            });
        });
        suite('all shells', () => {
            async function t(commandLine, expectedCommands) {
                for (const shell of ["bash" /* TreeSitterCommandParserLanguage.Bash */, "powershell" /* TreeSitterCommandParserLanguage.PowerShell */]) {
                    const result = await parser.extractSubCommands(shell, commandLine);
                    deepStrictEqual(result, expectedCommands);
                }
            }
            suite('edge cases', () => {
                test('empty strings', () => t('', []));
                test('whitespace-only strings', () => t('   \n\t  ', []));
            });
        });
    });
    suite('extractPwshDoubleAmpersandChainOperators', () => {
        async function t(commandLine, expectedMatches) {
            const result = await parser.extractPwshDoubleAmpersandChainOperators(commandLine);
            const actualMatches = result.map(capture => capture.node.text);
            deepStrictEqual(actualMatches, expectedMatches);
        }
        test('simple command with &&', () => t('Get-Date && Get-Location', ['&&']));
        test('multiple && operators', () => t('echo first && echo second && echo third', ['&&', '&&']));
        test('mixed operators - && and ;', () => t('echo hello && echo world ; echo done', ['&&']));
        test('no && operators', () => t('Get-Date ; Get-Location', []));
        test('&& in string literal should not match', () => t('Write-Host "test && test"', []));
        test('&& in single quotes should not match', () => t('Write-Host \'test && test\'', []));
        test('&& with complex commands', () => t('Get-ChildItem -Path C:\\ && Set-Location C:\\Users', ['&&']));
        test('&& with parameters', () => t('Get-Process -Name notepad && Stop-Process -Name notepad', ['&&']));
        test('&& with pipeline inside', () => t('Get-Process | Where-Object {$_.Name -eq "notepad"} && Write-Host "Found"', ['&&']));
        test('nested && in script blocks', () => t('if ($true) { echo hello && echo world }', ['&&']));
        test('&& with method calls', () => t('"hello".ToUpper() && "world".ToLower()', ['&&']));
        test('&& with array operations', () => t('@(1,2,3) | ForEach-Object { $_ } && Write-Host "done"', ['&&']));
        test('&& with hashtable', () => t('@{key="value"} && Write-Host "created"', ['&&']));
        test('&& with type casting', () => t('[int]"123" && [string]456', ['&&']));
        test('&& with comparison operators', () => t('5 -gt 3 && "hello" -like "h*"', ['&&']));
        test('&& with variable assignment', () => t('$var = "test" && Write-Host $var', ['&&']));
        test('&& with expandable strings', () => t('$name="World" && "Hello $name"', ['&&']));
        test('&& with subexpressions', () => t('Write-Host $(Get-Date) && Get-Location', ['&&']));
        test('&& with here-strings', () => t('Write-Host @"\nhello\nworld\n"@ && Get-Date', ['&&']));
        test('&& with splatting', () => t('$params = @{Path="C:\\"}; Get-ChildItem @params && Write-Host "done"', ['&&']));
        suite('complex scenarios', () => {
            test('multiple && with different command types', () => t('Get-Service && Start-Service spooler && Get-Process', ['&&', '&&']));
            test('&& with error handling', () => t('try { Get-Content "file.txt" && Write-Host "success" } catch { Write-Error "failed" }', ['&&']));
            test('&& inside foreach', () => t('ForEach-Object { Write-Host $_.Name && Write-Host $_.Length }', ['&&']));
            test('&& with conditional logic', () => t('if (Test-Path "file.txt") { Get-Content "file.txt" && Write-Host "read" }', ['&&']));
            test('&& with switch statement', () => t('switch ($var) { 1 { "one" && "first" } 2 { "two" && "second" } }', ['&&', '&&']));
            test('&& in do-while', () => t('do { Write-Host $i && $i++ } while ($i -lt 5)', ['&&']));
            test('&& in for loop', () => t('for ($i=0; $i -lt 5; $i++) { Write-Host $i && Start-Sleep 1 }', ['&&']));
            test('&& with parallel processing', () => t('1..10 | ForEach-Object -Parallel { Write-Host $_ && Start-Sleep 1 }', ['&&']));
        });
        suite('edge cases', () => {
            test('empty string', () => t('', []));
            test('whitespace only', () => t('   \n\t  ', []));
            test('triple &&&', () => t('echo hello &&& echo world', ['&&']));
            test('spaced && operators', () => t('echo hello & & echo world', []));
            test('&& with unicode', () => t('Write-Host "测试" && Write-Host "🚀"', ['&&']));
            test('very long command with &&', () => t('Write-Host "' + 'a'.repeat(1000) + '" && Get-Date', ['&&']));
            test('deeply nested with &&', () => t('if ($true) { if ($true) { if ($true) { echo nested && echo deep } } }', ['&&']));
            test('&& with escaped characters', () => t('Write-Host "hello`"world" && Get-Date', ['&&']));
            test('&& with backticks', () => t('Write-Host `hello && Get-Date', ['&&']));
        });
        suite('real-world scenarios', () => {
            test('git workflow', () => t('git add . && git commit -m "message" && git push', ['&&', '&&']));
            test('build and test', () => t('dotnet build && dotnet test && dotnet publish', ['&&', '&&']));
            test('file operations', () => t('New-Item -Type File "test.txt" && Add-Content "test.txt" "hello" && Get-Content "test.txt"', ['&&', '&&']));
            test('service management', () => t('Stop-Service spooler && Set-Service spooler -StartupType Manual && Start-Service spooler', ['&&', '&&']));
            test('registry operations', () => t('New-Item -Path "HKCU:\\Software\\Test" && Set-ItemProperty -Path "HKCU:\\Software\\Test" -Name "Value" -Value "Data"', ['&&']));
            test('module import and usage', () => t('Import-Module ActiveDirectory && Get-ADUser -Filter *', ['&&']));
            test('remote operations', () => t('Enter-PSSession -ComputerName server && Get-Process && Exit-PSSession', ['&&', '&&']));
            test('scheduled task', () => t('Register-ScheduledTask -TaskName "MyTask" -Action (New-ScheduledTaskAction -Execute "powershell.exe") && Start-ScheduledTask "MyTask"', ['&&']));
        });
    });
    suite('getFileWrites', () => {
        suite('bash', () => {
            async function t(commandLine, expectedFiles) {
                const actualFiles = await parser.getFileWrites("bash" /* TreeSitterCommandParserLanguage.Bash */, commandLine);
                deepStrictEqual(actualFiles, expectedFiles);
            }
            test('simple output redirection', () => t('echo hello > file.txt', ['file.txt']));
            test('append redirection', () => t('echo hello >> file.txt', ['file.txt']));
            test('multiple redirections', () => t('echo hello > file1.txt && echo world > file2.txt', ['file1.txt', 'file2.txt']));
            test('error redirection', () => t('command 2> error.log', ['error.log']));
            test('combined stdout and stderr', () => t('command > output.txt 2>&1', ['output.txt']));
            test('here document', () => t('cat > file.txt << EOF\nhello\nworld\nEOF', ['file.txt']));
            test('quoted filenames', () => t('echo hello > "file with spaces.txt"', ['"file with spaces.txt"']));
            test('single quoted filenames', () => t('echo hello > \'file.txt\'', ['\'file.txt\'']));
            test('variable in filename', () => t('echo hello > $HOME/file.txt', ['$HOME/file.txt']));
            test('command substitution in filename', () => t('echo hello > $(date +%Y%m%d).log', ['$(date +%Y%m%d).log']));
            test('tilde expansion in filename', () => t('echo hello > ~/file.txt', ['~/file.txt']));
            test('absolute path', () => t('echo hello > /tmp/file.txt', ['/tmp/file.txt']));
            test('relative path', () => t('echo hello > ./output/file.txt', ['./output/file.txt']));
            test('file descriptor redirection', () => t('command 3> file.txt', ['file.txt']));
            test('redirection with numeric file descriptor', () => t('command 1> stdout.txt 2> stderr.txt', ['stdout.txt', 'stderr.txt']));
            test('append with error redirection', () => t('command >> output.log 2>> error.log', ['output.log', 'error.log']));
            suite('complex scenarios', () => {
                test('multiple commands with redirections', () => t('echo first > file1.txt; echo second > file2.txt; echo third > file3.txt', ['file1.txt', 'file2.txt', 'file3.txt']));
                test('pipeline with redirection', () => t('cat input.txt | grep pattern > output.txt', ['output.txt']));
                test('redirection in subshell', () => t('(echo hello; echo world) > combined.txt', ['combined.txt']));
                test('redirection with background job', () => t('long_command > output.txt &', ['output.txt']));
                test('conditional redirection', () => t('test -f input.txt && cat input.txt > output.txt || echo "not found" > error.txt', ['output.txt', 'error.txt']));
                test('loop with redirection', () => t('for file in *.txt; do cat "$file" >> combined.txt; done', ['combined.txt']));
                test('function with redirection', () => t('function backup() { cp "$1" > backup_"$1"; }', ['backup_"$1"']));
            });
            suite('edge cases', () => {
                test('no redirections', () => t('echo hello', []));
                test('input redirection only', () => t('sort < input.txt', ['input.txt']));
                test('pipe without redirection', () => t('echo hello | grep hello', []));
                test('redirection to /dev/null', () => t('command > /dev/null', ['/dev/null']));
                test('redirection to device', () => t('echo hello > /dev/tty', ['/dev/tty']));
                test('special characters in filename', () => t('echo hello > file-with_special.chars123.txt', ['file-with_special.chars123.txt']));
                test('unicode filename', () => t('echo hello > 测试文件.txt', ['测试文件.txt']));
                test('very long filename', () => t('echo hello > ' + 'a'.repeat(100) + '.txt', [Array(100).fill('a').join('') + '.txt']));
            });
        });
        suite('pwsh', () => {
            async function t(commandLine, expectedFiles) {
                const actualFiles = await parser.getFileWrites("powershell" /* TreeSitterCommandParserLanguage.PowerShell */, commandLine);
                deepStrictEqual(actualFiles, expectedFiles);
            }
            test('simple output redirection', () => t('Write-Host "hello" > file.txt', ['file.txt']));
            test('append redirection', () => t('Write-Host "hello" >> file.txt', ['file.txt']));
            test('multiple redirections', () => t('Write-Host "hello" > file1.txt ; Write-Host "world" > file2.txt', ['file1.txt', 'file2.txt']));
            test('error redirection', () => t('Get-Content missing.txt 2> error.log', ['error.log']));
            test('warning redirection', () => t('Write-Warning "test" 3> warning.log', ['warning.log']));
            test('verbose redirection', () => t('Write-Verbose "test" 4> verbose.log', ['verbose.log']));
            test('debug redirection', () => t('Write-Debug "test" 5> debug.log', ['debug.log']));
            test('information redirection', () => t('Write-Information "test" 6> info.log', ['info.log']));
            test('all streams redirection', () => t('Get-Process *> all.log', ['all.log']));
            test('quoted filenames', () => t('Write-Host "hello" > "file with spaces.txt"', ['"file with spaces.txt"']));
            test('single quoted filenames', () => t('Write-Host "hello" > \'file.txt\'', ['\'file.txt\'']));
            test('variable in filename', () => t('Write-Host "hello" > $env:TEMP\\file.txt', ['$env:TEMP\\file.txt']));
            test('subexpression in filename', () => t('Write-Host "hello" > $(Get-Date -Format "yyyyMMdd").log', ['$(Get-Date -Format "yyyyMMdd").log']));
            test('Windows path', () => t('Write-Host "hello" > C:\\temp\\file.txt', ['C:\\temp\\file.txt']));
            test('UNC path', () => t('Write-Host "hello" > \\\\server\\share\\file.txt', ['\\\\server\\share\\file.txt']));
            test('relative path', () => t('Write-Host "hello" > .\\output\\file.txt', ['.\\output\\file.txt']));
            suite('complex scenarios', () => {
                test('pipeline with redirection', () => t('Get-Process | Where-Object {$_.CPU -gt 100} > processes.txt', ['processes.txt']));
                test('multiple streams to different files', () => t('Get-Content missing.txt > output.txt 2> error.txt 3> warning.txt', ['output.txt', 'error.txt', 'warning.txt']));
                test('redirection in script block', () => t('ForEach-Object { Write-Host $_.Name > names.txt }', ['names.txt']));
                test('conditional redirection', () => t('if (Test-Path "file.txt") { Get-Content "file.txt" > output.txt } else { Write-Host "not found" > error.txt }', ['output.txt', 'error.txt']));
                test('try-catch with redirection', () => t('try { Get-Content "file.txt" > output.txt } catch { $_.Exception.Message > error.txt }', ['output.txt', 'error.txt']));
                test('foreach loop with redirection', () => t('foreach ($file in Get-ChildItem) { $file.Name >> filelist.txt }', ['filelist.txt']));
                test('switch with redirection', () => t('switch ($var) { 1 { "one" > output1.txt } 2 { "two" > output2.txt } }', ['output1.txt', 'output2.txt']));
            });
            suite('edge cases', () => {
                test('no redirections', () => t('Write-Host "hello"', []));
                test('redirection to null', () => t('Write-Host "hello" > $null', ['$null']));
                test('redirection to console', () => t('Write-Host "hello" > CON', ['CON']));
                test('special characters in filename', () => t('Write-Host "hello" > file-with_special.chars123.txt', ['file-with_special.chars123.txt']));
                test('unicode filename', () => t('Write-Host "hello" > 测试文件.txt', ['测试文件.txt']));
                test('very long filename', () => t('Write-Host "hello" > ' + 'a'.repeat(100) + '.txt', [Array(100).fill('a').join('') + '.txt']));
                test('redirection operator in string', () => t('Write-Host "test > redirect" > file.txt', ['file.txt']));
                test('multiple redirection operators', () => t('Write-Host "hello" >> file.txt > otherfile.txt', ['file.txt', 'otherfile.txt']));
            });
            suite('real-world scenarios', () => {
                test('logging script output', () => t('Get-EventLog -LogName System -Newest 100 > system_events.log', ['system_events.log']));
                test('error logging', () => t('Start-Process -FilePath "nonexistent.exe" 2> process_errors.log', ['process_errors.log']));
                test('backup script with logging', () => t('Copy-Item -Path "source/*" -Destination "backup/" -Recurse > backup.log 2> backup_errors.log', ['backup.log', 'backup_errors.log']));
                test('system information export', () => t('Get-ComputerInfo | Out-String > system_info.txt', ['system_info.txt']));
                test('service status report', () => t('Get-Service | Where-Object {$_.Status -eq "Running"} | Select-Object Name, Status > running_services.csv', ['running_services.csv']));
                test('registry export', () => t('Get-ItemProperty -Path "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion" > registry_info.txt', ['registry_info.txt']));
                test('process monitoring', () => t('while ($true) { Get-Process | Measure-Object WorkingSet -Sum >> memory_usage.log; Start-Sleep 60 }', ['memory_usage.log']));
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZVNpdHRlckNvbW1hbmRQYXJzZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdEFnZW50VG9vbHMvdGVzdC9lbGVjdHJvbi1icm93c2VyL3RyZWVTaXR0ZXJDb21tYW5kUGFyc2VyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUN6QyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdEcsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0saUZBQWlGLENBQUM7QUFDNUgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBRXJGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx3RUFBd0UsQ0FBQztBQUNsSCxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNyRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUMxRyxPQUFPLEVBQUUsdUJBQXVCLEVBQW1DLE1BQU0sMENBQTBDLENBQUM7QUFFcEgsS0FBSyxDQUFDLHlCQUF5QixFQUFFLEdBQUcsRUFBRTtJQUNyQyxNQUFNLEtBQUssR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBRXhELElBQUksb0JBQThDLENBQUM7SUFDbkQsSUFBSSxNQUErQixDQUFDO0lBRXBDLEtBQUssQ0FBQyxHQUFHLEVBQUU7UUFDVixNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksV0FBVyxDQUFD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