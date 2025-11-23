/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ok, strictEqual } from 'assert';
import { Separator } from '../../../../../../base/common/actions.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { Schemas } from '../../../../../../base/common/network.js';
import { isLinux, isWindows } from '../../../../../../base/common/platform.js';
import { count } from '../../../../../../base/common/strings.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ITreeSitterLibraryService } from '../../../../../../editor/common/services/treeSitter/treeSitterLibraryService.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { FileService } from '../../../../../../platform/files/common/fileService.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService, toWorkspaceFolder } from '../../../../../../platform/workspace/common/workspace.js';
import { Workspace } from '../../../../../../platform/workspace/test/common/testWorkspace.js';
import { IHistoryService } from '../../../../../services/history/common/history.js';
import { TreeSitterLibraryService } from '../../../../../services/treeSitter/browser/treeSitterLibraryService.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { TestContextService } from '../../../../../test/common/workbenchTestServices.js';
import { TestIPCFileSystemProvider } from '../../../../../test/electron-browser/workbenchTestServices.js';
import { IChatService } from '../../../../chat/common/chatService.js';
import { LocalChatSessionUri } from '../../../../chat/common/chatUri.js';
import { ILanguageModelToolsService } from '../../../../chat/common/languageModelToolsService.js';
import { ITerminalChatService, ITerminalService } from '../../../../terminal/browser/terminal.js';
import { ITerminalProfileResolverService } from '../../../../terminal/common/terminal.js';
import { RunInTerminalTool } from '../../browser/tools/runInTerminalTool.js';
import { terminalChatAgentToolsConfiguration } from '../../common/terminalChatAgentToolsConfiguration.js';
import { TerminalChatService } from '../../../chat/browser/terminalChatService.js';
class TestRunInTerminalTool extends RunInTerminalTool {
    constructor() {
        super(...arguments);
        this._osBackend = Promise.resolve(1 /* OperatingSystem.Windows */);
    }
    get sessionTerminalAssociations() { return this._sessionTerminalAssociations; }
    get profileFetcher() { return this._profileFetcher; }
    setBackendOs(os) {
        this._osBackend = Promise.resolve(os);
    }
}
suite('RunInTerminalTool', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let configurationService;
    let fileService;
    let storageService;
    let workspaceContextService;
    let terminalServiceDisposeEmitter;
    let chatServiceDisposeEmitter;
    let runInTerminalTool;
    setup(() => {
        configurationService = new TestConfigurationService();
        workspaceContextService = new TestContextService();
        const logService = new NullLogService();
        fileService = store.add(new FileService(logService));
        const fileSystemProvider = new TestIPCFileSystemProvider();
        store.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
        setConfig("chat.tools.terminal.enableAutoApprove" /* TerminalChatAgentToolsSettingId.EnableAutoApprove */, true);
        terminalServiceDisposeEmitter = new Emitter();
        chatServiceDisposeEmitter = new Emitter();
        instantiationService = workbenchInstantiationService({
            configurationService: () => configurationService,
            fileService: () => fileService,
        }, store);
        instantiationService.stub(ITerminalChatService, store.add(instantiationService.createInstance(TerminalChatService)));
        instantiationService.stub(IWorkspaceContextService, workspaceContextService);
        instantiationService.stub(IHistoryService, {
            getLastActiveWorkspaceRoot: () => undefined
        });
        const treeSitterLibraryService = store.add(instantiationService.createInstance(TreeSitterLibraryService));
        treeSitterLibraryService.isTest = true;
        instantiationService.stub(ITreeSitterLibraryService, treeSitterLibraryService);
        instantiationService.stub(ILanguageModelToolsService, {
            getTools() {
                return [];
            },
        });
        instantiationService.stub(ITerminalService, {
            onDidDisposeInstance: terminalServiceDisposeEmitter.event,
            setNextCommandId: async () => { }
        });
        instantiationService.stub(IChatService, {
            onDidDisposeSession: chatServiceDisposeEmitter.event
        });
        instantiationService.stub(ITerminalProfileResolverService, {
            getDefaultProfile: async () => ({ path: 'bash' })
        });
        storageService = instantiationService.get(IStorageService);
        storageService.store("chat.tools.terminal.autoApprove.warningAccepted" /* TerminalToolConfirmationStorageKeys.TerminalAutoApproveWarningAccepted */, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        runInTerminalTool = store.add(instantiationService.createInstance(TestRunInTerminalTool));
    });
    function setAutoApprove(value) {
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
    function clearAutoApproveWarningAcceptedState() {
        storageService.remove("chat.tools.terminal.autoApprove.warningAccepted" /* TerminalToolConfirmationStorageKeys.TerminalAutoApproveWarningAccepted */, -1 /* StorageScope.APPLICATION */);
    }
    /**
     * Executes a test scenario for the RunInTerminalTool
     */
    async function executeToolTest(params) {
        const context = {
            parameters: {
                command: 'echo hello',
                explanation: 'Print hello to the console',
                isBackground: false,
                ...params
            }
        };
        const result = await runInTerminalTool.prepareToolInvocation(context, CancellationToken.None);
        return result;
    }
    function isSeparator(action) {
        return action instanceof Separator;
    }
    /**
     * Helper to assert that a command should be auto-approved (no confirmation required)
     */
    function assertAutoApproved(preparedInvocation) {
        ok(preparedInvocation, 'Expected prepared invocation to be defined');
        ok(!preparedInvocation.confirmationMessages, 'Expected no confirmation messages for auto-approved command');
    }
    /**
     * Helper to assert that a command requires confirmation
     */
    function assertConfirmationRequired(preparedInvocation, expectedTitle) {
        ok(preparedInvocation, 'Expected prepared invocation to be defined');
        ok(preparedInvocation.confirmationMessages, 'Expected confirmation messages for non-approved command');
        if (expectedTitle) {
            strictEqual(preparedInvocation.confirmationMessages.title, expectedTitle);
        }
    }
    suite('default auto-approve rules', () => {
        const defaults = terminalChatAgentToolsConfiguration["chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */].default;
        suiteSetup(() => {
            // Sanity check on entries to make sure that the defaults are actually pulled in
            ok(Object.keys(defaults).length > 50);
        });
        setup(() => {
            setAutoApprove(defaults);
        });
        const autoApprovedTestCases = [
            // Safe commands
            'echo abc',
            'echo "abc"',
            'echo \'abc\'',
            'ls -la',
            'pwd',
            'cat file.txt',
            'head -n 10 file.txt',
            'tail -f log.txt',
            'findstr pattern file.txt',
            'wc -l file.txt',
            'tr a-z A-Z',
            'cut -d: -f1',
            'cmp file1 file2',
            'which node',
            'basename /path/to/file',
            'dirname /path/to/file',
            'realpath .',
            'readlink symlink',
            'stat file.txt',
            'file document.pdf',
            'du -sh folder',
            'df -h',
            'sleep 5',
            'cd /home/user',
            'nl -ba path/to/file.txt',
            // Safe git sub-commands
            'git status',
            'git log --oneline',
            'git show HEAD',
            'git diff main',
            'git grep "TODO"',
            // PowerShell commands
            'Get-ChildItem',
            'Get-Date',
            'Get-Random',
            'Get-Location',
            'Write-Host "Hello"',
            'Write-Output "Test"',
            'Split-Path C:\\Users\\test',
            'Join-Path C:\\Users test',
            'Start-Sleep 2',
            // PowerShell safe verbs (regex patterns)
            'Select-Object Name',
            'Measure-Object Length',
            'Compare-Object $a $b',
            'Format-Table',
            'Sort-Object Name',
            // Commands with acceptable arguments
            'column data.txt',
            'date +%Y-%m-%d',
            'find . -name "*.txt"',
            'grep pattern file.txt',
            'sort file.txt',
            'tree directory'
        ];
        const confirmationRequiredTestCases = [
            // Dangerous file operations
            'rm README.md',
            'rmdir folder',
            'del file.txt',
            'Remove-Item file.txt',
            'ri file.txt',
            'rd folder',
            'erase file.txt',
            'dd if=/dev/zero of=file',
            // Process management
            'kill 1234',
            'ps aux',
            'top',
            'Stop-Process -Id 1234',
            'spps notepad',
            'taskkill /f /im notepad.exe',
            'taskkill.exe /f /im cmd.exe',
            // Web requests
            'curl https://example.com',
            'wget https://example.com/file',
            'Invoke-RestMethod https://api.example.com',
            'Invoke-WebRequest https://example.com',
            'irm https://example.com',
            'iwr https://example.com',
            // File permissions
            'chmod 755 file.sh',
            'chown user:group file.txt',
            'Set-ItemProperty file.txt IsReadOnly $true',
            'sp file.txt IsReadOnly $true',
            'Set-Acl file.txt $acl',
            // Command execution
            'jq \'.name\' file.json',
            'xargs rm',
            'eval "echo hello"',
            'Invoke-Expression "Get-Date"',
            'iex "Write-Host test"',
            // Commands with dangerous arguments
            'column -c 10000 file.txt',
            'date --set="2023-01-01"',
            'find . -delete',
            'find . -exec rm {} \\;',
            'find . -execdir rm {} \\;',
            'find . -fprint output.txt',
            'sort -o /etc/passwd file.txt',
            'sort -S 100G file.txt',
            'tree -o output.txt',
            // Transient environment variables
            'ls="test" curl https://api.example.com',
            'API_KEY=secret curl https://api.example.com',
            'HTTP_PROXY=proxy:8080 wget https://example.com',
            'VAR1=value1 VAR2=value2 echo test',
            'A=1 B=2 C=3 ./script.sh',
        ];
        suite.skip('auto approved', () => {
            for (const command of autoApprovedTestCases) {
                test(command.replaceAll('\n', '\\n'), async () => {
                    assertAutoApproved(await executeToolTest({ command }));
                });
            }
        });
        suite('confirmation required', () => {
            for (const command of confirmationRequiredTestCases) {
                test(command.replaceAll('\n', '\\n'), async () => {
                    assertConfirmationRequired(await executeToolTest({ command }));
                });
            }
        });
    });
    suite('prepareToolInvocation - auto approval behavior', () => {
        test('should auto-approve commands in allow list', async () => {
            setAutoApprove({
                echo: true
            });
            const result = await executeToolTest({ command: 'echo hello world' });
            assertAutoApproved(result);
        });
        test('should require confirmation for commands not in allow list', async () => {
            setAutoApprove({
                ls: true
            });
            const result = await executeToolTest({
                command: 'rm file.txt',
                explanation: 'Remove a file'
            });
            assertConfirmationRequired(result, 'Run `bash` command?');
        });
        test('should require confirmation for commands in deny list even if in allow list', async () => {
            setAutoApprove({
                rm: false,
                echo: true
            });
            const result = await executeToolTest({
                command: 'rm dangerous-file.txt',
                explanation: 'Remove a dangerous file'
            });
            assertConfirmationRequired(result, 'Run `bash` command?');
        });
        test('should handle background commands with confirmation', async () => {
            setAutoApprove({
                ls: true
            });
            const result = await executeToolTest({
                command: 'npm run watch',
                explanation: 'Start watching for file changes',
                isBackground: true
            });
            assertConfirmationRequired(result, 'Run `bash` command? (background terminal)');
        });
        test('should auto-approve background commands in allow list', async () => {
            setAutoApprove({
                npm: true
            });
            const result = await executeToolTest({
                command: 'npm run watch',
                explanation: 'Start watching for file changes',
                isBackground: true
            });
            assertAutoApproved(result);
        });
        test('should include auto-approve info for background commands', async () => {
            setAutoApprove({
                npm: true
            });
            const result = await executeToolTest({
                command: 'npm run watch',
                explanation: 'Start watching for file changes',
                isBackground: true
            });
            assertAutoApproved(result);
            // Verify that auto-approve information is included
            ok(result?.toolSpecificData, 'Expected toolSpecificData to be defined');
            // eslint-disable-next-line local/code-no-any-casts
            const terminalData = result.toolSpecificData;
            ok(terminalData.autoApproveInfo, 'Expected autoApproveInfo to be defined for auto-approved background command');
            ok(terminalData.autoApproveInfo.value, 'Expected autoApproveInfo to have a value');
            ok(terminalData.autoApproveInfo.value.includes('npm'), 'Expected autoApproveInfo to mention the approved rule');
        });
        test('should handle regex patterns in allow list', async () => {
            setAutoApprove({
                '/^git (status|log)/': true
            });
            const result = await executeToolTest({ command: 'git status --porcelain' });
            assertAutoApproved(result);
        });
        test('should handle complex command chains with sub-commands', async () => {
            setAutoApprove({
                echo: true,
                ls: true
            });
            const result = await executeToolTest({ command: 'echo "hello" && ls -la' });
            assertAutoApproved(result);
        });
        test('should require confirmation when one sub-command is not approved', async () => {
            setAutoApprove({
                echo: true
            });
            const result = await executeToolTest({ command: 'echo "hello" && rm file.txt' });
            assertConfirmationRequired(result);
        });
        test('should handle empty command strings', async () => {
            setAutoApprove({
                echo: true
            });
            const result = await executeToolTest({
                command: '',
                explanation: 'Empty command'
            });
            assertAutoApproved(result);
        });
        test('should handle matchCommandLine: true patterns', async () => {
            setAutoApprove({
                '/dangerous/': { approve: false, matchCommandLine: true },
                'echo': { approve: true, matchCommandLine: true }
            });
            const result1 = await executeToolTest({ command: 'echo hello world' });
            assertAutoApproved(result1);
            const result2 = await executeToolTest({ command: 'echo this is a dangerous command' });
            assertConfirmationRequired(result2);
        });
        test('should only approve when neither sub-commands or command lines are denied', async () => {
            setAutoApprove({
                'foo': true,
                '/^foo$/': { approve: false, matchCommandLine: true },
            });
            const result1 = await executeToolTest({ command: 'foo' });
            assertConfirmationRequired(result1);
            const result2 = await executeToolTest({ command: 'foo bar' });
            assertAutoApproved(result2);
        });
    });
    suite('prepareToolInvocation - custom actions for dropdown', () => {
        function assertDropdownActions(result, items) {
            const actions = result?.confirmationMessages?.terminalCustomActions;
            ok(actions, 'Expected custom actions to be defined');
            strictEqual(actions.length, items.length);
            for (const [i, item] of items.entries()) {
                const action = actions[i];
                if (item === '---') {
                    ok(isSeparator(action));
                }
                else {
                    ok(!isSeparator(action));
                    if (item === 'configure') {
                        strictEqual(action.label, 'Configure Auto Approve...');
                        strictEqual(action.data.type, 'configure');
                    }
                    else if (item === 'sessionApproval') {
                        strictEqual(action.label, 'Allow All Commands in this Session');
                        strictEqual(action.data.type, 'sessionApproval');
                    }
                    else if (item === 'commandLine') {
                        strictEqual(action.label, 'Always Allow Exact Command Line');
                        strictEqual(action.data.type, 'newRule');
                        ok(!Array.isArray(action.data.rule), 'Expected rule to be an object');
                    }
                    else {
                        if (Array.isArray(item.subCommand)) {
                            strictEqual(action.label, `Always Allow Commands: ${item.subCommand.join(', ')}`);
                        }
                        else {
                            strictEqual(action.label, `Always Allow Command: ${item.subCommand}`);
                        }
                        strictEqual(action.data.type, 'newRule');
                        ok(Array.isArray(action.data.rule), 'Expected rule to be an array');
                    }
                }
            }
        }
        test('should generate custom actions for non-auto-approved commands', async () => {
            setAutoApprove({
                ls: true,
            });
            const result = await executeToolTest({
                command: 'npm run build',
                explanation: 'Build the project'
            });
            assertConfirmationRequired(result, 'Run `bash` command?');
            assertDropdownActions(result, [
                { subCommand: 'npm run build' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should generate custom actions for single word commands', async () => {
            const result = await executeToolTest({
                command: 'foo',
                explanation: 'Run foo command'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'foo' },
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should not generate custom actions for auto-approved commands', async () => {
            setAutoApprove({
                npm: true
            });
            const result = await executeToolTest({
                command: 'npm run build',
                explanation: 'Build the project'
            });
            assertAutoApproved(result);
        });
        test('should only generate configure action for explicitly denied commands', async () => {
            setAutoApprove({
                npm: { approve: false }
            });
            const result = await executeToolTest({
                command: 'npm run build',
                explanation: 'Build the project'
            });
            assertConfirmationRequired(result, 'Run `bash` command?');
            assertDropdownActions(result, [
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should handle && in command line labels with proper mnemonic escaping', async () => {
            const result = await executeToolTest({
                command: 'npm install && npm run build',
                explanation: 'Install dependencies and build'
            });
            assertConfirmationRequired(result, 'Run `bash` command?');
            assertDropdownActions(result, [
                { subCommand: ['npm install', 'npm run build'] },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should not show approved commands in custom actions dropdown', async () => {
            setAutoApprove({
                head: true // head is approved by default in real scenario
            });
            const result = await executeToolTest({
                command: 'foo | head -20',
                explanation: 'Run foo command and show first 20 lines'
            });
            assertConfirmationRequired(result, 'Run `bash` command?');
            assertDropdownActions(result, [
                { subCommand: 'foo' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should not show any command-specific actions when all sub-commands are approved', async () => {
            setAutoApprove({
                foo: true,
                head: true
            });
            const result = await executeToolTest({
                command: 'foo | head -20',
                explanation: 'Run foo command and show first 20 lines'
            });
            assertAutoApproved(result);
        });
        test('should handle mixed approved and unapproved commands correctly', async () => {
            setAutoApprove({
                head: true,
                tail: true
            });
            const result = await executeToolTest({
                command: 'foo | head -20 && bar | tail -10',
                explanation: 'Run multiple piped commands'
            });
            assertConfirmationRequired(result, 'Run `bash` command?');
            assertDropdownActions(result, [
                { subCommand: ['foo', 'bar'] },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should suggest subcommand for git commands', async () => {
            const result = await executeToolTest({
                command: 'git status',
                explanation: 'Check git status'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'git status' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should suggest subcommand for npm commands', async () => {
            const result = await executeToolTest({
                command: 'npm test',
                explanation: 'Run npm tests'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'npm test' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should suggest 3-part subcommand for npm run commands', async () => {
            const result = await executeToolTest({
                command: 'npm run build',
                explanation: 'Run build script'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'npm run build' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should suggest 3-part subcommand for yarn run commands', async () => {
            const result = await executeToolTest({
                command: 'yarn run test',
                explanation: 'Run test script'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'yarn run test' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should not suggest subcommand for commands with flags', async () => {
            const result = await executeToolTest({
                command: 'foo --foo --bar',
                explanation: 'Run foo with flags'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'foo' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should not suggest subcommand for npm run with flags', async () => {
            const result = await executeToolTest({
                command: 'npm run abc --some-flag',
                explanation: 'Run npm run abc with flags'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'npm run abc' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should handle mixed npm run and other commands', async () => {
            const result = await executeToolTest({
                command: 'npm run build && git status',
                explanation: 'Build and check status'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: ['npm run build', 'git status'] },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should suggest mixed subcommands and base commands', async () => {
            const result = await executeToolTest({
                command: 'git push && echo "done"',
                explanation: 'Push and print done'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: ['git push', 'echo'] },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should suggest subcommands for multiple git commands', async () => {
            const result = await executeToolTest({
                command: 'git status && git log --oneline',
                explanation: 'Check status and log'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: ['git status', 'git log'] },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should suggest base command for non-subcommand tools', async () => {
            const result = await executeToolTest({
                command: 'foo bar',
                explanation: 'Download from example.com'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'foo' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should handle single word commands from subcommand-aware tools', async () => {
            const result = await executeToolTest({
                command: 'git',
                explanation: 'Run git command'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should deduplicate identical subcommand suggestions', async () => {
            const result = await executeToolTest({
                command: 'npm test && npm test --verbose',
                explanation: 'Run tests twice'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'npm test' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should handle flags differently than subcommands for suggestion logic', async () => {
            const result = await executeToolTest({
                command: 'foo --version',
                explanation: 'Check foo version'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                { subCommand: 'foo' },
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should not suggest overly permissive subcommand rules', async () => {
            const result = await executeToolTest({
                command: 'bash -c "echo hello"',
                explanation: 'Run bash command'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                'commandLine',
                '---',
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should not show command line option when it\'s rejected', async () => {
            setAutoApprove({
                echo: true,
                '/\\(.+\\)/s': { approve: false, matchCommandLine: true }
            });
            const result = await executeToolTest({
                command: 'echo (abc)'
            });
            assertConfirmationRequired(result);
            assertDropdownActions(result, [
                'sessionApproval',
                '---',
                'configure',
            ]);
        });
        test('should prevent auto approval when writing to a file outside the workspace', async () => {
            setConfig("chat.tools.terminal.blockDetectedFileWrites" /* TerminalChatAgentToolsSettingId.BlockDetectedFileWrites */, 'outsideWorkspace');
            setAutoApprove({});
            const workspaceFolder = URI.file(isWindows ? 'C:/workspace/project' : '/workspace/project');
            const workspace = new Workspace('test', [toWorkspaceFolder(workspaceFolder)]);
            workspaceContextService.setWorkspace(workspace);
            instantiationService.stub(IHistoryService, {
                getLastActiveWorkspaceRoot: () => workspaceFolder
            });
            const result = await executeToolTest({
                command: 'echo "abc" > ../file.txt'
            });
            assertConfirmationRequired(result);
            strictEqual(result?.confirmationMessages?.terminalCustomActions, undefined, 'Expected no custom actions when file write is blocked');
        });
    });
    suite('chat session disposal cleanup', () => {
        test('should dispose associated terminals when chat session is disposed', () => {
            const sessionId = 'test-session-123';
            // eslint-disable-next-line local/code-no-any-casts
            const mockTerminal = {
                dispose: () => { },
                processId: 12345
            };
            let terminalDisposed = false;
            mockTerminal.dispose = () => { terminalDisposed = true; };
            runInTerminalTool.sessionTerminalAssociations.set(sessionId, {
                instance: mockTerminal,
                shellIntegrationQuality: "none" /* ShellIntegrationQuality.None */
            });
            ok(runInTerminalTool.sessionTerminalAssociations.has(sessionId), 'Terminal association should exist before disposal');
            chatServiceDisposeEmitter.fire({ sessionResource: LocalChatSessionUri.forSession(sessionId), reason: 'cleared' });
            strictEqual(terminalDisposed, true, 'Terminal should have been disposed');
            ok(!runInTerminalTool.sessionTerminalAssociations.has(sessionId), 'Terminal association should be removed after disposal');
        });
        test('should not affect other sessions when one session is disposed', () => {
            const sessionId1 = 'test-session-1';
            const sessionId2 = 'test-session-2';
            // eslint-disable-next-line local/code-no-any-casts
            const mockTerminal1 = {
                dispose: () => { },
                processId: 12345
            };
            // eslint-disable-next-line local/code-no-any-casts
            const mockTerminal2 = {
                dispose: () => { },
                processId: 67890
            };
            let terminal1Disposed = false;
            let terminal2Disposed = false;
            mockTerminal1.dispose = () => { terminal1Disposed = true; };
            mockTerminal2.dispose = () => { terminal2Disposed = true; };
            runInTerminalTool.sessionTerminalAssociations.set(sessionId1, {
                instance: mockTerminal1,
                shellIntegrationQuality: "none" /* ShellIntegrationQuality.None */
            });
            runInTerminalTool.sessionTerminalAssociations.set(sessionId2, {
                instance: mockTerminal2,
                shellIntegrationQuality: "none" /* ShellIntegrationQuality.None */
            });
            ok(runInTerminalTool.sessionTerminalAssociations.has(sessionId1), 'Session 1 terminal association should exist');
            ok(runInTerminalTool.sessionTerminalAssociations.has(sessionId2), 'Session 2 terminal association should exist');
            chatServiceDisposeEmitter.fire({ sessionResource: LocalChatSessionUri.forSession(sessionId1), reason: 'cleared' });
            strictEqual(terminal1Disposed, true, 'Terminal 1 should have been disposed');
            strictEqual(terminal2Disposed, false, 'Terminal 2 should NOT have been disposed');
            ok(!runInTerminalTool.sessionTerminalAssociations.has(sessionId1), 'Session 1 terminal association should be removed');
            ok(runInTerminalTool.sessionTerminalAssociations.has(sessionId2), 'Session 2 terminal association should remain');
        });
        test('should handle disposal of non-existent session gracefully', () => {
            strictEqual(runInTerminalTool.sessionTerminalAssociations.size, 0, 'No associations should exist initially');
            chatServiceDisposeEmitter.fire({ sessionResource: LocalChatSessionUri.forSession('non-existent-session'), reason: 'cleared' });
            strictEqual(runInTerminalTool.sessionTerminalAssociations.size, 0, 'No associations should exist after handling non-existent session');
        });
    });
    suite('auto approve warning acceptance mechanism', () => {
        test('should require confirmation for auto-approvable commands when warning not accepted', async () => {
            setConfig("chat.tools.terminal.enableAutoApprove" /* TerminalChatAgentToolsSettingId.EnableAutoApprove */, true);
            setAutoApprove({
                echo: true
            });
            clearAutoApproveWarningAcceptedState();
            assertConfirmationRequired(await executeToolTest({ command: 'echo hello world' }), 'Run `bash` command?');
        });
        test('should auto-approve commands when both auto-approve enabled and warning accepted', async () => {
            setConfig("chat.tools.terminal.enableAutoApprove" /* TerminalChatAgentToolsSettingId.EnableAutoApprove */, true);
            setAutoApprove({
                echo: true
            });
            assertAutoApproved(await executeToolTest({ command: 'echo hello world' }));
        });
        test('should require confirmation when auto-approve disabled regardless of warning acceptance', async () => {
            setConfig("chat.tools.terminal.enableAutoApprove" /* TerminalChatAgentToolsSettingId.EnableAutoApprove */, false);
            setAutoApprove({
                echo: true
            });
            const result = await executeToolTest({ command: 'echo hello world' });
            assertConfirmationRequired(result, 'Run `bash` command?');
        });
    });
    suite('unique rules deduplication', () => {
        test('should properly deduplicate rules with same sourceText in auto-approve info', async () => {
            setAutoApprove({
                echo: true
            });
            const result = await executeToolTest({ command: 'echo hello && echo world' });
            assertAutoApproved(result);
            const autoApproveInfo = result.toolSpecificData.autoApproveInfo;
            ok(autoApproveInfo);
            ok(autoApproveInfo.value.includes('Auto approved by rule '), 'should contain singular "rule", not plural');
            strictEqual(count(autoApproveInfo.value, 'echo'), 1);
        });
    });
    suite('session auto approval', () => {
        test('should auto approve all commands when session has auto approval enabled', async () => {
            const sessionId = 'test-session-123';
            const terminalChatService = instantiationService.get(ITerminalChatService);
            const context = {
                parameters: {
                    command: 'rm dangerous-file.txt',
                    explanation: 'Remove a file',
                    isBackground: false
                },
                chatSessionId: sessionId
            };
            let result = await runInTerminalTool.prepareToolInvocation(context, CancellationToken.None);
            assertConfirmationRequired(result);
            terminalChatService.setChatSessionAutoApproval(sessionId, true);
            result = await runInTerminalTool.prepareToolInvocation(context, CancellationToken.None);
            assertAutoApproved(result);
            const terminalData = result.toolSpecificData;
            ok(terminalData.autoApproveInfo, 'Expected autoApproveInfo to be defined');
            ok(terminalData.autoApproveInfo.value.includes('Auto approved for this session'), 'Expected session approval message');
        });
    });
    suite('TerminalProfileFetcher', () => {
        suite('getCopilotProfile', () => {
            (isWindows ? test : test.skip)('should return custom profile when configured', async () => {
                runInTerminalTool.setBackendOs(1 /* OperatingSystem.Windows */);
                const customProfile = Object.freeze({ path: 'C:\\Windows\\System32\\powershell.exe', args: ['-NoProfile'] });
                setConfig("chat.tools.terminal.terminalProfile.windows" /* TerminalChatAgentToolsSettingId.TerminalProfileWindows */, customProfile);
                const result = await runInTerminalTool.profileFetcher.getCopilotProfile();
                strictEqual(result, customProfile);
            });
            (isLinux ? test : test.skip)('should fall back to default shell when no custom profile is configured', async () => {
                runInTerminalTool.setBackendOs(3 /* OperatingSystem.Linux */);
                setConfig("chat.tools.terminal.terminalProfile.linux" /* TerminalChatAgentToolsSettingId.TerminalProfileLinux */, null);
                const result = await runInTerminalTool.profileFetcher.getCopilotProfile();
                strictEqual(typeof result, 'object');
                strictEqual(result.path, 'bash');
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuSW5UZXJtaW5hbFRvb2wudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdEFnZW50VG9vbHMvdGVzdC9lbGVjdHJvbi1icm93c2VyL3J1bkluVGVybWluYWxUb29sLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDekMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQW1CLE1BQU0sMkNBQTJDLENBQUM7QUFDaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRWpFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN0RyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxpRkFBaUYsQ0FBQztBQUU1SCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxrRkFBa0YsQ0FBQztBQUU1SCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFckYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sc0RBQXNELENBQUM7QUFFcEgsT0FBTyxFQUFFLHdCQUF3QixF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