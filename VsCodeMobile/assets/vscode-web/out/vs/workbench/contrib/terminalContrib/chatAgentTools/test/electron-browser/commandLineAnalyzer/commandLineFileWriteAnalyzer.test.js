/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual } from 'assert';
import { Schemas } from '../../../../../../../base/common/network.js';
import { isWindows } from '../../../../../../../base/common/platform.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { ITreeSitterLibraryService } from '../../../../../../../editor/common/services/treeSitter/treeSitterLibraryService.js';
import { TestConfigurationService } from '../../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { FileService } from '../../../../../../../platform/files/common/fileService.js';
import { NullLogService } from '../../../../../../../platform/log/common/log.js';
import { IWorkspaceContextService, toWorkspaceFolder } from '../../../../../../../platform/workspace/common/workspace.js';
import { Workspace } from '../../../../../../../platform/workspace/test/common/testWorkspace.js';
import { TreeSitterLibraryService } from '../../../../../../services/treeSitter/browser/treeSitterLibraryService.js';
import { workbenchInstantiationService } from '../../../../../../test/browser/workbenchTestServices.js';
import { TestContextService } from '../../../../../../test/common/workbenchTestServices.js';
import { TestIPCFileSystemProvider } from '../../../../../../test/electron-browser/workbenchTestServices.js';
import { CommandLineFileWriteAnalyzer } from '../../../browser/tools/commandLineAnalyzer/commandLineFileWriteAnalyzer.js';
import { TreeSitterCommandParser } from '../../../browser/treeSitterCommandParser.js';
suite('CommandLineFileWriteAnalyzer', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let parser;
    let analyzer;
    let configurationService;
    let workspaceContextService;
    const mockLog = (..._args) => { };
    setup(() => {
        const fileService = store.add(new FileService(new NullLogService()));
        const fileSystemProvider = new TestIPCFileSystemProvider();
        store.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
        configurationService = new TestConfigurationService();
        workspaceContextService = new TestContextService();
        instantiationService = workbenchInstantiationService({
            fileService: () => fileService,
            configurationService: () => configurationService
        }, store);
        instantiationService.stub(IWorkspaceContextService, workspaceContextService);
        const treeSitterLibraryService = store.add(instantiationService.createInstance(TreeSitterLibraryService));
        treeSitterLibraryService.isTest = true;
        instantiationService.stub(ITreeSitterLibraryService, treeSitterLibraryService);
        parser = store.add(instantiationService.createInstance(TreeSitterCommandParser));
        analyzer = store.add(instantiationService.createInstance(CommandLineFileWriteAnalyzer, parser, mockLog));
    });
    (isWindows ? suite.skip : suite)('bash', () => {
        const cwd = URI.file('/workspace/project');
        async function t(commandLine, blockDetectedFileWrites, expectedAutoApprove, expectedDisclaimers = 0, workspaceFolders = [cwd]) {
            configurationService.setUserConfiguration("chat.tools.terminal.blockDetectedFileWrites" /* TerminalChatAgentToolsSettingId.BlockDetectedFileWrites */, blockDetectedFileWrites);
            // Setup workspace folders
            const workspace = new Workspace('test', workspaceFolders.map(uri => toWorkspaceFolder(uri)));
            workspaceContextService.setWorkspace(workspace);
            const options = {
                commandLine,
                cwd,
                shell: 'bash',
                os: 3 /* OperatingSystem.Linux */,
                treeSitterLanguage: "bash" /* TreeSitterCommandParserLanguage.Bash */,
                terminalToolSessionId: 'test',
                chatSessionId: 'test',
            };
            const result = await analyzer.analyze(options);
            strictEqual(result.isAutoApproveAllowed, expectedAutoApprove, `Expected auto approve to be ${expectedAutoApprove} for: ${commandLine}`);
            strictEqual((result.disclaimers || []).length, expectedDisclaimers, `Expected ${expectedDisclaimers} disclaimers for: ${commandLine}`);
        }
        suite('blockDetectedFileWrites: never', () => {
            test('relative path - simple output redirection', () => t('echo hello > file.txt', 'never', true, 1));
            test('relative path - append redirection', () => t('echo hello >> file.txt', 'never', true, 1));
            test('relative paths - multiple redirections', () => t('echo hello > file1.txt && echo world > file2.txt', 'never', true, 1));
            test('relative path - error redirection', () => t('cat missing.txt 2> error.log', 'never', true, 1));
            test('no redirections', () => t('echo hello', 'never', true, 0));
            test('absolute path - /dev/null allowed with never', () => t('echo hello > /dev/null', 'never', true, 1));
        });
        suite('blockDetectedFileWrites: outsideWorkspace', () => {
            // Relative paths (joined with cwd)
            test('relative path - file in workspace root - allow', () => t('echo hello > file.txt', 'outsideWorkspace', true, 1));
            test('relative path - file in subdirectory - allow', () => t('echo hello > subdir/file.txt', 'outsideWorkspace', true, 1));
            test('relative path - parent directory - block', () => t('echo hello > ../file.txt', 'outsideWorkspace', false, 1));
            test('relative path - grandparent directory - block', () => t('echo hello > ../../file.txt', 'outsideWorkspace', false, 1));
            // Absolute paths (parsed as-is)
            test('absolute path - /tmp - block', () => t('echo hello > /tmp/file.txt', 'outsideWorkspace', false, 1));
            test('absolute path - /etc - block', () => t('echo hello > /etc/config.txt', 'outsideWorkspace', false, 1));
            test('absolute path - /home - block', () => t('echo hello > /home/user/file.txt', 'outsideWorkspace', false, 1));
            test('absolute path - root - block', () => t('echo hello > /file.txt', 'outsideWorkspace', false, 1));
            test('absolute path - /dev/null - allow (null device)', () => t('echo hello > /dev/null', 'outsideWorkspace', true, 1));
            // Special cases
            test('no workspace folders - block', () => t('echo hello > file.txt', 'outsideWorkspace', false, 1, []));
            test('no workspace folders - /dev/null allowed', () => t('echo hello > /dev/null', 'outsideWorkspace', true, 1, []));
            test('no redirections - allow', () => t('echo hello', 'outsideWorkspace', true, 0));
            test('variable in filename - block', () => t('echo hello > $HOME/file.txt', 'outsideWorkspace', false, 1));
            test('command substitution - block', () => t('echo hello > $(pwd)/file.txt', 'outsideWorkspace', false, 1));
            test('brace expansion - block', () => t('echo hello > {a,b}.txt', 'outsideWorkspace', false, 1));
        });
        suite('blockDetectedFileWrites: all', () => {
            test('inside workspace - block', () => t('echo hello > file.txt', 'all', false, 1));
            test('outside workspace - block', () => t('echo hello > /tmp/file.txt', 'all', false, 1));
            test('no redirections - allow', () => t('echo hello', 'all', true, 0));
            test('multiple inside workspace - block', () => t('echo hello > file1.txt && echo world > file2.txt', 'all', false, 1));
        });
        suite('complex scenarios', () => {
            test('pipeline with redirection inside workspace', () => t('cat file.txt | grep "test" > output.txt', 'outsideWorkspace', true, 1));
            test('multiple redirections mixed inside/outside', () => t('echo hello > file.txt && echo world > /tmp/file.txt', 'outsideWorkspace', false, 1));
            test('here-document', () => t('cat > file.txt << EOF\nhello\nEOF', 'outsideWorkspace', true, 1));
            test('error output to /dev/null - allow', () => t('cat missing.txt 2> /dev/null', 'outsideWorkspace', true, 1));
        });
        suite('no cwd provided', () => {
            async function tNoCwd(commandLine, blockDetectedFileWrites, expectedAutoApprove, expectedDisclaimers = 0) {
                configurationService.setUserConfiguration("chat.tools.terminal.blockDetectedFileWrites" /* TerminalChatAgentToolsSettingId.BlockDetectedFileWrites */, blockDetectedFileWrites);
                const workspace = new Workspace('test', [toWorkspaceFolder(cwd)]);
                workspaceContextService.setWorkspace(workspace);
                const options = {
                    commandLine,
                    cwd: undefined,
                    shell: 'bash',
                    os: 3 /* OperatingSystem.Linux */,
                    treeSitterLanguage: "bash" /* TreeSitterCommandParserLanguage.Bash */,
                    terminalToolSessionId: 'test',
                    chatSessionId: 'test',
                };
                const result = await analyzer.analyze(options);
                strictEqual(result.isAutoApproveAllowed, expectedAutoApprove, `Expected auto approve to be ${expectedAutoApprove} for: ${commandLine}`);
                strictEqual((result.disclaimers || []).length, expectedDisclaimers, `Expected ${expectedDisclaimers} disclaimers for: ${commandLine}`);
            }
            // When cwd is undefined, relative paths remain as strings and are blocked
            test('relative path - never setting - allow', () => tNoCwd('echo hello > file.txt', 'never', true, 1));
            test('relative path - outsideWorkspace setting - block (unknown cwd)', () => tNoCwd('echo hello > file.txt', 'outsideWorkspace', false, 1));
            test('relative path - all setting - block', () => tNoCwd('echo hello > file.txt', 'all', false, 1));
            // Absolute paths are converted to URIs and checked normally
            test('absolute path inside workspace - outsideWorkspace setting - allow', () => tNoCwd('echo hello > /workspace/project/file.txt', 'outsideWorkspace', true, 1));
            test('absolute path outside workspace - outsideWorkspace setting - block', () => tNoCwd('echo hello > /tmp/file.txt', 'outsideWorkspace', false, 1));
            test('absolute path - all setting - block', () => tNoCwd('echo hello > /tmp/file.txt', 'all', false, 1));
        });
    });
    (isWindows ? suite : suite.skip)('pwsh', () => {
        const cwd = URI.file('C:/workspace/project');
        async function t(commandLine, blockDetectedFileWrites, expectedAutoApprove, expectedDisclaimers = 0, workspaceFolders = [cwd]) {
            configurationService.setUserConfiguration("chat.tools.terminal.blockDetectedFileWrites" /* TerminalChatAgentToolsSettingId.BlockDetectedFileWrites */, blockDetectedFileWrites);
            // Setup workspace folders
            const workspace = new Workspace('test', workspaceFolders.map(uri => toWorkspaceFolder(uri)));
            workspaceContextService.setWorkspace(workspace);
            const options = {
                commandLine,
                cwd,
                shell: 'pwsh',
                os: 1 /* OperatingSystem.Windows */,
                treeSitterLanguage: "powershell" /* TreeSitterCommandParserLanguage.PowerShell */,
                terminalToolSessionId: 'test',
                chatSessionId: 'test',
            };
            const result = await analyzer.analyze(options);
            strictEqual(result.isAutoApproveAllowed, expectedAutoApprove, `Expected auto approve to be ${expectedAutoApprove} for: ${commandLine}`);
            strictEqual((result.disclaimers || []).length, expectedDisclaimers, `Expected ${expectedDisclaimers} disclaimers for: ${commandLine}`);
        }
        suite('blockDetectedFileWrites: never', () => {
            test('simple output redirection', () => t('Write-Host "hello" > file.txt', 'never', true, 1));
            test('append redirection', () => t('Write-Host "hello" >> file.txt', 'never', true, 1));
            test('multiple redirections', () => t('Write-Host "hello" > file1.txt ; Write-Host "world" > file2.txt', 'never', true, 1));
            test('error redirection', () => t('Get-Content missing.txt 2> error.log', 'never', true, 1));
            test('no redirections', () => t('Write-Host "hello"', 'never', true, 0));
        });
        suite('blockDetectedFileWrites: outsideWorkspace', () => {
            // Relative paths (joined with cwd)
            test('relative path - file in workspace root - allow', () => t('Write-Host "hello" > file.txt', 'outsideWorkspace', true, 1));
            test('relative path - file in subdirectory - allow', () => t('Write-Host "hello" > subdir\\file.txt', 'outsideWorkspace', true, 1));
            test('relative path - parent directory - block', () => t('Write-Host "hello" > ..\\file.txt', 'outsideWorkspace', false, 1));
            test('relative path - grandparent directory - block', () => t('Write-Host "hello" > ..\\..\\file.txt', 'outsideWorkspace', false, 1));
            // Absolute paths - Windows drive letters (parsed as-is)
            test('absolute path - C: drive - block', () => t('Write-Host "hello" > C:\\temp\\file.txt', 'outsideWorkspace', false, 1));
            test('absolute path - D: drive - block', () => t('Write-Host "hello" > D:\\data\\config.txt', 'outsideWorkspace', false, 1));
            test('absolute path - different drive than workspace - block', () => t('Write-Host "hello" > E:\\external\\file.txt', 'outsideWorkspace', false, 1));
            // Absolute paths - UNC paths
            test('absolute path - UNC path - block', () => t('Write-Host "hello" > \\\\server\\share\\file.txt', 'outsideWorkspace', false, 1));
            // Special cases
            test('no workspace folders - block', () => t('Write-Host "hello" > file.txt', 'outsideWorkspace', false, 1, []));
            test('no redirections - allow', () => t('Write-Host "hello"', 'outsideWorkspace', true, 0));
            test('variable in filename - block', () => t('Write-Host "hello" > $env:TEMP\\file.txt', 'outsideWorkspace', false, 1));
            test('subexpression - block', () => t('Write-Host "hello" > $(Get-Date).log', 'outsideWorkspace', false, 1));
        });
        suite('blockDetectedFileWrites: all', () => {
            test('inside workspace - block', () => t('Write-Host "hello" > file.txt', 'all', false, 1));
            test('outside workspace - block', () => t('Write-Host "hello" > C:\\temp\\file.txt', 'all', false, 1));
            test('no redirections - allow', () => t('Write-Host "hello"', 'all', true, 0));
            test('multiple inside workspace - block', () => t('Write-Host "hello" > file1.txt ; Write-Host "world" > file2.txt', 'all', false, 1));
        });
        suite('complex scenarios', () => {
            test('pipeline with redirection inside workspace', () => t('Get-Process | Where-Object {$_.CPU -gt 100} > processes.txt', 'outsideWorkspace', true, 1));
            test('multiple redirections mixed inside/outside', () => t('Write-Host "hello" > file.txt ; Write-Host "world" > C:\\temp\\file.txt', 'outsideWorkspace', false, 1));
            test('all streams redirection', () => t('Get-Process *> all.log', 'outsideWorkspace', true, 1));
            test('multiple stream redirections', () => t('Get-Content missing.txt > output.txt 2> error.txt 3> warning.txt', 'outsideWorkspace', true, 1));
        });
        suite('edge cases', () => {
            test('redirection to $null (PowerShell null device) - allow', () => t('Write-Host "hello" > $null', 'outsideWorkspace', true, 1));
            test('relative path with backslashes - allow', () => t('Write-Host "hello" > server\\share\\file.txt', 'outsideWorkspace', true, 1));
            test('quoted filename inside workspace - allow', () => t('Write-Host "hello" > "file with spaces.txt"', 'outsideWorkspace', true, 1));
            test('forward slashes on Windows (relative) - allow', () => t('Write-Host "hello" > subdir/file.txt', 'outsideWorkspace', true, 1));
        });
    });
    suite('disclaimer messages', () => {
        const cwd = URI.file('/workspace/project');
        async function checkDisclaimer(commandLine, blockDetectedFileWrites, expectedContains) {
            configurationService.setUserConfiguration("chat.tools.terminal.blockDetectedFileWrites" /* TerminalChatAgentToolsSettingId.BlockDetectedFileWrites */, blockDetectedFileWrites);
            const workspace = new Workspace('test', [toWorkspaceFolder(cwd)]);
            workspaceContextService.setWorkspace(workspace);
            const options = {
                commandLine,
                cwd,
                shell: 'bash',
                os: 3 /* OperatingSystem.Linux */,
                treeSitterLanguage: "bash" /* TreeSitterCommandParserLanguage.Bash */,
                terminalToolSessionId: 'test',
                chatSessionId: 'test',
            };
            const result = await analyzer.analyze(options);
            const disclaimers = result.disclaimers || [];
            strictEqual(disclaimers.length > 0, true, 'Expected at least one disclaimer');
            const combinedDisclaimers = disclaimers.join(' ');
            strictEqual(combinedDisclaimers.includes(expectedContains), true, `Expected disclaimer to contain "${expectedContains}" but got: ${combinedDisclaimers}`);
        }
        test('blocked disclaimer - absolute path outside workspace', () => checkDisclaimer('echo hello > /tmp/file.txt', 'outsideWorkspace', 'cannot be auto approved'));
        test('allowed disclaimer - relative path inside workspace', () => checkDisclaimer('echo hello > file.txt', 'outsideWorkspace', 'File write operations detected'));
        test('blocked disclaimer - all setting blocks everything', () => checkDisclaimer('echo hello > file.txt', 'all', 'cannot be auto approved'));
    });
    suite('multiple workspace folders', () => {
        const workspace1 = URI.file('/workspace/project1');
        const workspace2 = URI.file('/workspace/project2');
        async function t(cwd, commandLine, expectedAutoApprove, expectedDisclaimers = 0) {
            configurationService.setUserConfiguration("chat.tools.terminal.blockDetectedFileWrites" /* TerminalChatAgentToolsSettingId.BlockDetectedFileWrites */, 'outsideWorkspace');
            const workspace = new Workspace('test', [workspace1, workspace2].map(uri => toWorkspaceFolder(uri)));
            workspaceContextService.setWorkspace(workspace);
            const options = {
                commandLine,
                cwd,
                shell: 'bash',
                os: 3 /* OperatingSystem.Linux */,
                treeSitterLanguage: "bash" /* TreeSitterCommandParserLanguage.Bash */,
                terminalToolSessionId: 'test',
                chatSessionId: 'test',
            };
            const result = await analyzer.analyze(options);
            strictEqual(result.isAutoApproveAllowed, expectedAutoApprove, `Expected auto approve to be ${expectedAutoApprove} for: ${commandLine}`);
            strictEqual((result.disclaimers || []).length, expectedDisclaimers, `Expected ${expectedDisclaimers} disclaimers for: ${commandLine}`);
        }
        test('relative path in same workspace - allow', () => t(workspace1, 'echo hello > file.txt', true, 1));
        test('absolute path to other workspace - allow', () => t(workspace1, 'echo hello > /workspace/project2/file.txt', true, 1));
        test('absolute path outside all workspaces - block', () => t(workspace1, 'echo hello > /tmp/file.txt', false, 1));
        test('relative path to parent of workspace - block', () => t(workspace1, 'echo hello > ../file.txt', false, 1));
    });
    suite('uri schemes', () => {
        async function t(cwdScheme, filePath, expectedAutoApprove) {
            configurationService.setUserConfiguration("chat.tools.terminal.blockDetectedFileWrites" /* TerminalChatAgentToolsSettingId.BlockDetectedFileWrites */, 'outsideWorkspace');
            const cwd = URI.from({ scheme: cwdScheme, path: '/workspace/project' });
            const workspace = new Workspace('test', [toWorkspaceFolder(cwd)]);
            workspaceContextService.setWorkspace(workspace);
            const options = {
                commandLine: `echo hello > ${filePath}`,
                cwd,
                shell: 'bash',
                os: 3 /* OperatingSystem.Linux */,
                treeSitterLanguage: "bash" /* TreeSitterCommandParserLanguage.Bash */,
                terminalToolSessionId: 'test',
                chatSessionId: 'test',
            };
            const result = await analyzer.analyze(options);
            strictEqual(result.isAutoApproveAllowed, expectedAutoApprove);
        }
        test('file scheme - relative path inside workspace', () => t('file', 'file.txt', true));
        test('vscode-remote scheme - relative path inside workspace', () => t('vscode-remote', 'file.txt', true));
        test('vscode-remote scheme - absolute path outside workspace', () => t('vscode-remote', '/tmp/file.txt', false));
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZExpbmVGaWxlV3JpdGVBbmFseXplci50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0QWdlbnRUb29scy90ZXN0L2VsZWN0cm9uLWJyb3dzZXIvY29tbWFuZExpbmVBbmFseXplci9jb21tYW5kTGluZUZpbGVXcml0ZUFuYWx5emVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUNyQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdEUsT0FBTyxFQUFFLFNBQVMsRUFBbUIsTUFBTSw4Q0FBOEMsQ0FBQztBQUMxRixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDekcsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sb0ZBQW9GLENBQUM7QUFDL0gsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0scUZBQXFGLENBQUM7QUFDL0gsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBRXhGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNqRixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUMxSCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0VBQXNFLENBQUM7QUFDakcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMkVBQTJFLENBQUM7QUFDckgsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDeEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1B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