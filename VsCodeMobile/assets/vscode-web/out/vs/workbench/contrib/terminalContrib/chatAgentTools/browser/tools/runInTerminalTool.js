/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var RunInTerminalTool_1;
import { timeout } from '../../../../../../base/common/async.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { CancellationError } from '../../../../../../base/common/errors.js';
import { Event } from '../../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { basename } from '../../../../../../base/common/path.js';
import { OS } from '../../../../../../base/common/platform.js';
import { count } from '../../../../../../base/common/strings.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { localize } from '../../../../../../nls.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { ITerminalLogService } from '../../../../../../platform/terminal/common/terminal.js';
import { IRemoteAgentService } from '../../../../../services/remote/common/remoteAgentService.js';
import { IChatService } from '../../../../chat/common/chatService.js';
import { ILanguageModelToolsService, ToolDataSource, ToolInvocationPresentation } from '../../../../chat/common/languageModelToolsService.js';
import { ITerminalChatService, ITerminalService } from '../../../../terminal/browser/terminal.js';
import { ITerminalProfileResolverService } from '../../../../terminal/common/terminal.js';
import { getRecommendedToolsOverRunInTerminal } from '../alternativeRecommendation.js';
import { BasicExecuteStrategy } from '../executeStrategy/basicExecuteStrategy.js';
import { NoneExecuteStrategy } from '../executeStrategy/noneExecuteStrategy.js';
import { RichExecuteStrategy } from '../executeStrategy/richExecuteStrategy.js';
import { getOutput } from '../outputHelpers.js';
import { isFish, isPowerShell, isWindowsPowerShell, isZsh } from '../runInTerminalHelpers.js';
import { RunInTerminalToolTelemetry } from '../runInTerminalToolTelemetry.js';
import { ToolTerminalCreator } from '../toolTerminalCreator.js';
import { TreeSitterCommandParser } from '../treeSitterCommandParser.js';
import { CommandLineAutoApproveAnalyzer } from './commandLineAnalyzer/commandLineAutoApproveAnalyzer.js';
import { CommandLineFileWriteAnalyzer } from './commandLineAnalyzer/commandLineFileWriteAnalyzer.js';
import { OutputMonitor } from './monitoring/outputMonitor.js';
import { OutputMonitorState } from './monitoring/types.js';
import { LocalChatSessionUri } from '../../../../chat/common/chatUri.js';
import { CommandLineCdPrefixRewriter } from './commandLineRewriter/commandLineCdPrefixRewriter.js';
import { CommandLinePwshChainOperatorRewriter } from './commandLineRewriter/commandLinePwshChainOperatorRewriter.js';
import { IWorkspaceContextService } from '../../../../../../platform/workspace/common/workspace.js';
import { IHistoryService } from '../../../../../services/history/common/history.js';
import { TerminalCommandArtifactCollector } from './terminalCommandArtifactCollector.js';
import { isNumber, isString } from '../../../../../../base/common/types.js';
import { ChatConfiguration } from '../../../../chat/common/constants.js';
import { IChatWidgetService } from '../../../../chat/browser/chat.js';
// #region Tool data
const TOOL_REFERENCE_NAME = 'runInTerminal';
const LEGACY_TOOL_REFERENCE_FULL_NAMES = ['runCommands/runInTerminal'];
function createPowerShellModelDescription(shell) {
    const isWinPwsh = isWindowsPowerShell(shell);
    return [
        `This tool allows you to execute ${isWinPwsh ? 'Windows PowerShell 5.1' : 'PowerShell'} commands in a persistent terminal session, preserving environment variables, working directory, and other context across multiple commands.`,
        '',
        'Command Execution:',
        // IMPORTANT: PowerShell 5 does not support `&&` so always re-write them to `;`. Note that
        // the behavior of `&&` differs a little from `;` but in general it's fine
        isWinPwsh ? '- Use semicolons ; to chain commands on one line, NEVER use && even when asked explicitly' : '- Prefer ; when chaining commands on one line',
        '- Prefer pipelines | for object-based data flow',
        '- Never create a sub-shell (eg. powershell -c "command") unless explicitly asked',
        '',
        'Directory Management:',
        '- Must use absolute paths to avoid navigation issues',
        '- Use $PWD or Get-Location for current directory',
        '- Use Push-Location/Pop-Location for directory stack',
        '',
        'Program Execution:',
        '- Supports .NET, Python, Node.js, and other executables',
        '- Install modules via Install-Module, Install-Package',
        '- Use Get-Command to verify cmdlet/function availability',
        '',
        'Background Processes:',
        '- For long-running tasks (e.g., servers), set isBackground=true',
        '- Returns a terminal ID for checking status and runtime later',
        '- Use Start-Job for background PowerShell jobs',
        '',
        'Output Management:',
        '- Output is automatically truncated if longer than 60KB to prevent context overflow',
        '- Use Select-Object, Where-Object, Format-Table to filter output',
        '- Use -First/-Last parameters to limit results',
        '- For pager commands, add | Out-String or | Format-List',
        '',
        'Best Practices:',
        '- Use proper cmdlet names instead of aliases in scripts',
        '- Quote paths with spaces: "C:\\Path With Spaces"',
        '- Prefer PowerShell cmdlets over external commands when available',
        '- Prefer idiomatic PowerShell like Get-ChildItem instead of dir or ls for file listings',
        '- Use Test-Path to check file/directory existence',
        '- Be specific with Select-Object properties to avoid excessive output'
    ].join('\n');
}
const genericDescription = `
Command Execution:
- Use && to chain simple commands on one line
- Prefer pipelines | over temporary files for data flow
- Never create a sub-shell (eg. bash -c "command") unless explicitly asked

Directory Management:
- Must use absolute paths to avoid navigation issues
- Use $PWD for current directory references
- Consider using pushd/popd for directory stack management
- Supports directory shortcuts like ~ and -

Program Execution:
- Supports Python, Node.js, and other executables
- Install packages via package managers (brew, apt, etc.)
- Use which or command -v to verify command availability

Background Processes:
- For long-running tasks (e.g., servers), set isBackground=true
- Returns a terminal ID for checking status and runtime later

Output Management:
- Output is automatically truncated if longer than 60KB to prevent context overflow
- Use head, tail, grep, awk to filter and limit output size
- For pager commands, disable paging: git --no-pager or add | cat
- Use wc -l to count lines before displaying large outputs

Best Practices:
- Quote variables: "$var" instead of $var to handle spaces
- Use find with -exec or xargs for file operations
- Be specific with commands to avoid excessive output`;
function createBashModelDescription() {
    return [
        'This tool allows you to execute shell commands in a persistent bash terminal session, preserving environment variables, working directory, and other context across multiple commands.',
        genericDescription,
        '- Use [[ ]] for conditional tests instead of [ ]',
        '- Prefer $() over backticks for command substitution',
        '- Use set -e at start of complex commands to exit on errors'
    ].join('\n');
}
function createZshModelDescription() {
    return [
        'This tool allows you to execute shell commands in a persistent zsh terminal session, preserving environment variables, working directory, and other context across multiple commands.',
        genericDescription,
        '- Use type to check command type (builtin, function, alias)',
        '- Use jobs, fg, bg for job control',
        '- Use [[ ]] for conditional tests instead of [ ]',
        '- Prefer $() over backticks for command substitution',
        '- Use setopt errexit for strict error handling',
        '- Take advantage of zsh globbing features (**, extended globs)'
    ].join('\n');
}
function createFishModelDescription() {
    return [
        'This tool allows you to execute shell commands in a persistent fish terminal session, preserving environment variables, working directory, and other context across multiple commands.',
        genericDescription,
        '- Use type to check command type (builtin, function, alias)',
        '- Use jobs, fg, bg for job control',
        '- Use test expressions for conditionals (no [[ ]] syntax)',
        '- Prefer command substitution with () syntax',
        '- Variables are arrays by default, use $var[1] for first element',
        '- Use set -e for strict error handling',
        '- Take advantage of fish\'s autosuggestions and completions'
    ].join('\n');
}
export async function createRunInTerminalToolData(accessor) {
    const instantiationService = accessor.get(IInstantiationService);
    const profileFetcher = instantiationService.createInstance(TerminalProfileFetcher);
    const shell = await profileFetcher.getCopilotShell();
    const os = await profileFetcher.osBackend;
    let modelDescription;
    if (shell && os && isPowerShell(shell, os)) {
        modelDescription = createPowerShellModelDescription(shell);
    }
    else if (shell && os && isZsh(shell, os)) {
        modelDescription = createZshModelDescription();
    }
    else if (shell && os && isFish(shell, os)) {
        modelDescription = createFishModelDescription();
    }
    else {
        modelDescription = createBashModelDescription();
    }
    return {
        id: 'run_in_terminal',
        toolReferenceName: TOOL_REFERENCE_NAME,
        legacyToolReferenceFullNames: LEGACY_TOOL_REFERENCE_FULL_NAMES,
        displayName: localize('runInTerminalTool.displayName', 'Run in Terminal'),
        modelDescription,
        userDescription: localize('runInTerminalTool.userDescription', 'Run commands in the terminal'),
        source: ToolDataSource.Internal,
        icon: Codicon.terminal,
        inputSchema: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The command to run in the terminal.'
                },
                explanation: {
                    type: 'string',
                    description: 'A one-sentence description of what the command does. This will be shown to the user before the command is run.'
                },
                isBackground: {
                    type: 'boolean',
                    description: 'Whether the command starts a background process. If true, the command will run in the background and you will not see the output. If false, the tool call will block on the command finishing, and then you will get the output. Examples of background processes: building in watch mode, starting a server. You can check the output of a background process later on by using get_terminal_output.'
                },
            },
            required: [
                'command',
                'explanation',
                'isBackground',
            ]
        }
    };
}
// #endregion
// #region Tool implementation
var TerminalToolStorageKeysInternal;
(function (TerminalToolStorageKeysInternal) {
    TerminalToolStorageKeysInternal["TerminalSession"] = "chat.terminalSessions";
})(TerminalToolStorageKeysInternal || (TerminalToolStorageKeysInternal = {}));
/**
 * A set of characters to ignore when reporting telemetry
 */
const telemetryIgnoredSequences = [
    '\x1b[I', // Focus in
    '\x1b[O', // Focus out
];
let RunInTerminalTool = class RunInTerminalTool extends Disposable {
    static { RunInTerminalTool_1 = this; }
    static { this._backgroundExecutions = new Map(); }
    static getBackgroundOutput(id) {
        const backgroundExecution = RunInTerminalTool_1._backgroundExecutions.get(id);
        if (!backgroundExecution) {
            throw new Error('Invalid terminal ID');
        }
        return backgroundExecution.getOutput();
    }
    constructor(_chatService, _configurationService, _historyService, _instantiationService, _languageModelToolsService, _remoteAgentService, _storageService, _terminalChatService, _logService, _terminalService, _workspaceContextService, _chatWidgetService) {
        super();
        this._chatService = _chatService;
        this._configurationService = _configurationService;
        this._historyService = _historyService;
        this._instantiationService = _instantiationService;
        this._languageModelToolsService = _languageModelToolsService;
        this._remoteAgentService = _remoteAgentService;
        this._storageService = _storageService;
        this._terminalChatService = _terminalChatService;
        this._logService = _logService;
        this._terminalService = _terminalService;
        this._workspaceContextService = _workspaceContextService;
        this._chatWidgetService = _chatWidgetService;
        this._sessionTerminalAssociations = new Map();
        this._osBackend = this._remoteAgentService.getEnvironment().then(remoteEnv => remoteEnv?.os ?? OS);
        this._terminalToolCreator = this._instantiationService.createInstance(ToolTerminalCreator);
        this._treeSitterCommandParser = this._register(this._instantiationService.createInstance(TreeSitterCommandParser));
        this._telemetry = this._instantiationService.createInstance(RunInTerminalToolTelemetry);
        this._commandArtifactCollector = this._instantiationService.createInstance(TerminalCommandArtifactCollector);
        this._profileFetcher = this._instantiationService.createInstance(TerminalProfileFetcher);
        this._commandLineRewriters = [
            this._register(this._instantiationService.createInstance(CommandLineCdPrefixRewriter)),
            this._register(this._instantiationService.createInstance(CommandLinePwshChainOperatorRewriter, this._treeSitterCommandParser)),
        ];
        this._commandLineAnalyzers = [
            this._register(this._instantiationService.createInstance(CommandLineFileWriteAnalyzer, this._treeSitterCommandParser, (message, args) => this._logService.info(`RunInTerminalTool#CommandLineFileWriteAnalyzer: ${message}`, args))),
            this._register(this._instantiationService.createInstance(CommandLineAutoApproveAnalyzer, this._treeSitterCommandParser, this._telemetry, (message, args) => this._logService.info(`RunInTerminalTool#CommandLineAutoApproveAnalyzer: ${message}`, args))),
        ];
        // Clear out warning accepted state if the setting is disabled
        this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, e => {
            if (!e || e.affectsConfiguration("chat.tools.terminal.enableAutoApprove" /* TerminalChatAgentToolsSettingId.EnableAutoApprove */)) {
                if (this._configurationService.getValue("chat.tools.terminal.enableAutoApprove" /* TerminalChatAgentToolsSettingId.EnableAutoApprove */) !== true) {
                    this._storageService.remove("chat.tools.terminal.autoApprove.warningAccepted" /* TerminalToolConfirmationStorageKeys.TerminalAutoApproveWarningAccepted */, -1 /* StorageScope.APPLICATION */);
                }
            }
        }));
        // Restore terminal associations from storage
        this._restoreTerminalAssociations();
        this._register(this._terminalService.onDidDisposeInstance(e => {
            for (const [sessionId, toolTerminal] of this._sessionTerminalAssociations.entries()) {
                if (e === toolTerminal.instance) {
                    this._sessionTerminalAssociations.delete(sessionId);
                }
            }
        }));
        // Listen for chat session disposal to clean up associated terminals
        this._register(this._chatService.onDidDisposeSession(e => {
            const localSessionId = LocalChatSessionUri.parseLocalSessionId(e.sessionResource);
            if (localSessionId) {
                this._cleanupSessionTerminals(localSessionId);
            }
        }));
    }
    async prepareToolInvocation(context, token) {
        const args = context.parameters;
        const instance = context.chatSessionId ? this._sessionTerminalAssociations.get(context.chatSessionId)?.instance : undefined;
        const [os, shell, cwd] = await Promise.all([
            this._osBackend,
            this._profileFetcher.getCopilotShell(),
            (async () => {
                let cwd = await instance?.getCwdResource();
                if (!cwd) {
                    const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot();
                    const workspaceFolder = activeWorkspaceRootUri ? this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? undefined : undefined;
                    cwd = workspaceFolder?.uri;
                }
                return cwd;
            })()
        ]);
        const language = os === 1 /* OperatingSystem.Windows */ ? 'pwsh' : 'sh';
        const terminalToolSessionId = generateUuid();
        // Generate a custom command ID to link the command between renderer and pty host
        const terminalCommandId = `tool-${generateUuid()}`;
        let rewrittenCommand = args.command;
        for (const rewriter of this._commandLineRewriters) {
            const rewriteResult = await rewriter.rewrite({
                commandLine: rewrittenCommand,
                cwd,
                shell,
                os
            });
            if (rewriteResult) {
                rewrittenCommand = rewriteResult.rewritten;
                this._logService.info(`RunInTerminalTool: Command rewritten by ${rewriter.constructor.name}: ${rewriteResult.reasoning}`);
            }
        }
        const toolSpecificData = {
            kind: 'terminal',
            terminalToolSessionId,
            terminalCommandId,
            commandLine: {
                original: args.command,
                toolEdited: rewrittenCommand === args.command ? undefined : rewrittenCommand
            },
            language,
        };
        // HACK: Exit early if there's an alternative recommendation, this is a little hacky but
        // it's the current mechanism for re-routing terminal tool calls to something else.
        const alternativeRecommendation = getRecommendedToolsOverRunInTerminal(args.command, this._languageModelToolsService);
        if (alternativeRecommendation) {
            toolSpecificData.alternativeRecommendation = alternativeRecommendation;
            return {
                confirmationMessages: undefined,
                presentation: ToolInvocationPresentation.Hidden,
                toolSpecificData,
            };
        }
        // Determine auto approval, this happens even when auto approve is off to that reasoning
        // can be reviewed in the terminal channel. It also allows gauging the effective set of
        // commands that would be auto approved if it were enabled.
        const commandLine = rewrittenCommand ?? args.command;
        const isEligibleForAutoApproval = () => {
            const config = this._configurationService.getValue(ChatConfiguration.EligibleForAutoApproval);
            if (config && typeof config === 'object') {
                if (Object.prototype.hasOwnProperty.call(config, TOOL_REFERENCE_NAME)) {
                    return config[TOOL_REFERENCE_NAME];
                }
                for (const legacyName of LEGACY_TOOL_REFERENCE_FULL_NAMES) {
                    if (Object.prototype.hasOwnProperty.call(config, legacyName)) {
                        return config[legacyName];
                    }
                }
            }
            // Default
            return true;
        };
        const isAutoApproveEnabled = this._configurationService.getValue("chat.tools.terminal.enableAutoApprove" /* TerminalChatAgentToolsSettingId.EnableAutoApprove */) === true;
        const isAutoApproveWarningAccepted = this._storageService.getBoolean("chat.tools.terminal.autoApprove.warningAccepted" /* TerminalToolConfirmationStorageKeys.TerminalAutoApproveWarningAccepted */, -1 /* StorageScope.APPLICATION */, false);
        const isAutoApproveAllowed = isEligibleForAutoApproval() && isAutoApproveEnabled && isAutoApproveWarningAccepted;
        const commandLineAnalyzerOptions = {
            commandLine,
            cwd,
            os,
            shell,
            treeSitterLanguage: isPowerShell(shell, os) ? "powershell" /* TreeSitterCommandParserLanguage.PowerShell */ : "bash" /* TreeSitterCommandParserLanguage.Bash */,
            terminalToolSessionId,
            chatSessionId: context.chatSessionId,
        };
        const commandLineAnalyzerResults = await Promise.all(this._commandLineAnalyzers.map(e => e.analyze(commandLineAnalyzerOptions)));
        const disclaimersRaw = commandLineAnalyzerResults.filter(e => e.disclaimers).flatMap(e => e.disclaimers);
        let disclaimer;
        if (disclaimersRaw.length > 0) {
            disclaimer = new MarkdownString(`$(${Codicon.info.id}) ` + disclaimersRaw.join(' '), { supportThemeIcons: true });
        }
        const analyzersIsAutoApproveAllowed = commandLineAnalyzerResults.every(e => e.isAutoApproveAllowed);
        const customActions = isEligibleForAutoApproval() && analyzersIsAutoApproveAllowed ? commandLineAnalyzerResults.map(e => e.customActions ?? []).flat() : undefined;
        let shellType = basename(shell, '.exe');
        if (shellType === 'powershell') {
            shellType = 'pwsh';
        }
        const isFinalAutoApproved = (
        // Is the setting enabled and the user has opted-in
        isAutoApproveAllowed &&
            // Does at least one analyzer auto approve
            commandLineAnalyzerResults.some(e => e.isAutoApproved) &&
            // No analyzer denies auto approval
            commandLineAnalyzerResults.every(e => e.isAutoApproved !== false) &&
            // All analyzers allow auto approval
            analyzersIsAutoApproveAllowed);
        if (isFinalAutoApproved) {
            toolSpecificData.autoApproveInfo = commandLineAnalyzerResults.find(e => e.autoApproveInfo)?.autoApproveInfo;
        }
        const confirmationMessages = isFinalAutoApproved ? undefined : {
            title: args.isBackground
                ? localize('runInTerminal.background', "Run `{0}` command? (background terminal)", shellType)
                : localize('runInTerminal', "Run `{0}` command?", shellType),
            message: new MarkdownString(args.explanation),
            disclaimer,
            terminalCustomActions: customActions,
        };
        return {
            confirmationMessages,
            toolSpecificData,
        };
    }
    async invoke(invocation, _countTokens, _progress, token) {
        const toolSpecificData = invocation.toolSpecificData;
        if (!toolSpecificData) {
            throw new Error('toolSpecificData must be provided for this tool');
        }
        const commandId = toolSpecificData.terminalCommandId;
        if (toolSpecificData.alternativeRecommendation) {
            return {
                content: [{
                        kind: 'text',
                        value: toolSpecificData.alternativeRecommendation
                    }]
            };
        }
        const args = invocation.parameters;
        this._logService.debug(`RunInTerminalTool: Invoking with options ${JSON.stringify(args)}`);
        let toolResultMessage;
        const chatSessionId = invocation.context?.sessionId ?? 'no-chat-session';
        const command = toolSpecificData.commandLine.userEdited ?? toolSpecificData.commandLine.toolEdited ?? toolSpecificData.commandLine.original;
        const didUserEditCommand = (toolSpecificData.commandLine.userEdited !== undefined &&
            toolSpecificData.commandLine.userEdited !== toolSpecificData.commandLine.original);
        const didToolEditCommand = (!didUserEditCommand &&
            toolSpecificData.commandLine.toolEdited !== undefined &&
            toolSpecificData.commandLine.toolEdited !== toolSpecificData.commandLine.original);
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        let error;
        const isNewSession = !args.isBackground && !this._sessionTerminalAssociations.has(chatSessionId);
        const timingStart = Date.now();
        const termId = generateUuid();
        const terminalToolSessionId = toolSpecificData.terminalToolSessionId;
        const store = new DisposableStore();
        this._logService.debug(`RunInTerminalTool: Creating ${args.isBackground ? 'background' : 'foreground'} terminal. termId=${termId}, chatSessionId=${chatSessionId}`);
        const toolTerminal = await (args.isBackground
            ? this._initBackgroundTerminal(chatSessionId, termId, terminalToolSessionId, token)
            : this._initForegroundTerminal(chatSessionId, termId, terminalToolSessionId, token));
        this._handleTerminalVisibility(toolTerminal, chatSessionId);
        const timingConnectMs = Date.now() - timingStart;
        const xterm = await toolTerminal.instance.xtermReadyPromise;
        if (!xterm) {
            throw new Error('Instance was disposed before xterm.js was ready');
        }
        const commandDetection = toolTerminal.instance.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        let inputUserChars = 0;
        let inputUserSigint = false;
        store.add(xterm.raw.onData(data => {
            if (!telemetryIgnoredSequences.includes(data)) {
                inputUserChars += data.length;
            }
            inputUserSigint ||= data === '\x03';
        }));
        let outputMonitor;
        if (args.isBackground) {
            let pollingResult;
            try {
                this._logService.debug(`RunInTerminalTool: Starting background execution \`${command}\``);
                const execution = new BackgroundTerminalExecution(toolTerminal.instance, xterm, command, chatSessionId, commandId);
                RunInTerminalTool_1._backgroundExecutions.set(termId, execution);
                outputMonitor = store.add(this._instantiationService.createInstance(OutputMonitor, execution, undefined, invocation.context, token, command));
                await Event.toPromise(outputMonitor.onDidFinishCommand);
                const pollingResult = outputMonitor.pollingResult;
                if (token.isCancellationRequested) {
                    throw new CancellationError();
                }
                await this._commandArtifactCollector.capture(toolSpecificData, toolTerminal.instance, commandId);
                const state = toolSpecificData.terminalCommandState ?? {};
                state.timestamp = state.timestamp ?? timingStart;
                toolSpecificData.terminalCommandState = state;
                let resultText = (didUserEditCommand
                    ? `Note: The user manually edited the command to \`${command}\`, and that command is now running in terminal with ID=${termId}`
                    : didToolEditCommand
                        ? `Note: The tool simplified the command to \`${command}\`, and that command is now running in terminal with ID=${termId}`
                        : `Command is running in terminal with ID=${termId}`);
                if (pollingResult && pollingResult.modelOutputEvalResponse) {
                    resultText += `\n\ The command became idle with output:\n${pollingResult.modelOutputEvalResponse}`;
                }
                else if (pollingResult) {
                    resultText += `\n\ The command is still running, with output:\n${pollingResult.output}`;
                }
                return {
                    toolMetadata: {
                        exitCode: undefined // Background processes don't have immediate exit codes
                    },
                    content: [{
                            kind: 'text',
                            value: resultText,
                        }],
                };
            }
            catch (e) {
                if (termId) {
                    RunInTerminalTool_1._backgroundExecutions.get(termId)?.dispose();
                    RunInTerminalTool_1._backgroundExecutions.delete(termId);
                }
                error = e instanceof CancellationError ? 'canceled' : 'unexpectedException';
                throw e;
            }
            finally {
                store.dispose();
                this._logService.debug(`RunInTerminalTool: Finished polling \`${pollingResult?.output.length}\` lines of output in \`${pollingResult?.pollDurationMs}\``);
                const timingExecuteMs = Date.now() - timingStart;
                this._telemetry.logInvoke(toolTerminal.instance, {
                    terminalToolSessionId: toolSpecificData.terminalToolSessionId,
                    didUserEditCommand,
                    didToolEditCommand,
                    shellIntegrationQuality: toolTerminal.shellIntegrationQuality,
                    isBackground: true,
                    error,
                    exitCode: undefined,
                    isNewSession: true,
                    timingExecuteMs,
                    timingConnectMs,
                    terminalExecutionIdleBeforeTimeout: pollingResult?.state === OutputMonitorState.Idle,
                    outputLineCount: pollingResult?.output ? count(pollingResult.output, '\n') : 0,
                    pollDurationMs: pollingResult?.pollDurationMs,
                    inputUserChars,
                    inputUserSigint,
                    inputToolManualAcceptCount: outputMonitor?.outputMonitorTelemetryCounters.inputToolManualAcceptCount,
                    inputToolManualRejectCount: outputMonitor?.outputMonitorTelemetryCounters.inputToolManualRejectCount,
                    inputToolManualChars: outputMonitor?.outputMonitorTelemetryCounters.inputToolManualChars,
                    inputToolAutoAcceptCount: outputMonitor?.outputMonitorTelemetryCounters.inputToolAutoAcceptCount,
                    inputToolAutoChars: outputMonitor?.outputMonitorTelemetryCounters.inputToolAutoChars,
                    inputToolManualShownCount: outputMonitor?.outputMonitorTelemetryCounters.inputToolManualShownCount,
                    inputToolFreeFormInputCount: outputMonitor?.outputMonitorTelemetryCounters.inputToolFreeFormInputCount,
                    inputToolFreeFormInputShownCount: outputMonitor?.outputMonitorTelemetryCounters.inputToolFreeFormInputShownCount
                });
            }
        }
        else {
            let terminalResult = '';
            let outputLineCount = -1;
            let exitCode;
            try {
                let strategy;
                switch (toolTerminal.shellIntegrationQuality) {
                    case "none" /* ShellIntegrationQuality.None */: {
                        strategy = this._instantiationService.createInstance(NoneExecuteStrategy, toolTerminal.instance, () => toolTerminal.receivedUserInput ?? false);
                        toolResultMessage = '$(info) Enable [shell integration](https://code.visualstudio.com/docs/terminal/shell-integration) to improve command detection';
                        break;
                    }
                    case "basic" /* ShellIntegrationQuality.Basic */: {
                        strategy = this._instantiationService.createInstance(BasicExecuteStrategy, toolTerminal.instance, () => toolTerminal.receivedUserInput ?? false, commandDetection);
                        break;
                    }
                    case "rich" /* ShellIntegrationQuality.Rich */: {
                        strategy = this._instantiationService.createInstance(RichExecuteStrategy, toolTerminal.instance, commandDetection);
                        break;
                    }
                }
                this._logService.debug(`RunInTerminalTool: Using \`${strategy.type}\` execute strategy for command \`${command}\``);
                store.add(strategy.onDidCreateStartMarker(startMarker => {
                    if (!outputMonitor) {
                        outputMonitor = store.add(this._instantiationService.createInstance(OutputMonitor, { instance: toolTerminal.instance, sessionId: invocation.context?.sessionId, getOutput: (marker) => getOutput(toolTerminal.instance, marker ?? startMarker) }, undefined, invocation.context, token, command));
                    }
                }));
                const executeResult = await strategy.execute(command, token, commandId);
                // Reset user input state after command execution completes
                toolTerminal.receivedUserInput = false;
                if (token.isCancellationRequested) {
                    throw new CancellationError();
                }
                await this._commandArtifactCollector.capture(toolSpecificData, toolTerminal.instance, commandId);
                {
                    const state = toolSpecificData.terminalCommandState ?? {};
                    state.timestamp = state.timestamp ?? timingStart;
                    if (executeResult.exitCode !== undefined) {
                        state.exitCode = executeResult.exitCode;
                        if (state.timestamp !== undefined) {
                            state.duration = state.duration ?? Math.max(0, Date.now() - state.timestamp);
                        }
                    }
                    toolSpecificData.terminalCommandState = state;
                }
                this._logService.debug(`RunInTerminalTool: Finished \`${strategy.type}\` execute strategy with exitCode \`${executeResult.exitCode}\`, result.length \`${executeResult.output?.length}\`, error \`${executeResult.error}\``);
                outputLineCount = executeResult.output === undefined ? 0 : count(executeResult.output.trim(), '\n') + 1;
                exitCode = executeResult.exitCode;
                error = executeResult.error;
                const resultArr = [];
                if (executeResult.output !== undefined) {
                    resultArr.push(executeResult.output);
                }
                if (executeResult.additionalInformation) {
                    resultArr.push(executeResult.additionalInformation);
                }
                terminalResult = resultArr.join('\n\n');
            }
            catch (e) {
                this._logService.debug(`RunInTerminalTool: Threw exception`);
                toolTerminal.instance.dispose();
                error = e instanceof CancellationError ? 'canceled' : 'unexpectedException';
                throw e;
            }
            finally {
                store.dispose();
                const timingExecuteMs = Date.now() - timingStart;
                this._telemetry.logInvoke(toolTerminal.instance, {
                    terminalToolSessionId: toolSpecificData.terminalToolSessionId,
                    didUserEditCommand,
                    didToolEditCommand,
                    isBackground: false,
                    shellIntegrationQuality: toolTerminal.shellIntegrationQuality,
                    error,
                    isNewSession,
                    outputLineCount,
                    exitCode,
                    timingExecuteMs,
                    timingConnectMs,
                    inputUserChars,
                    inputUserSigint,
                    terminalExecutionIdleBeforeTimeout: undefined,
                    pollDurationMs: undefined,
                    inputToolManualAcceptCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolManualAcceptCount,
                    inputToolManualRejectCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolManualRejectCount,
                    inputToolManualChars: outputMonitor?.outputMonitorTelemetryCounters?.inputToolManualChars,
                    inputToolAutoAcceptCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolAutoAcceptCount,
                    inputToolAutoChars: outputMonitor?.outputMonitorTelemetryCounters?.inputToolAutoChars,
                    inputToolManualShownCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolManualShownCount,
                    inputToolFreeFormInputCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolFreeFormInputCount,
                    inputToolFreeFormInputShownCount: outputMonitor?.outputMonitorTelemetryCounters?.inputToolFreeFormInputShownCount
                });
            }
            const resultText = [];
            if (didUserEditCommand) {
                resultText.push(`Note: The user manually edited the command to \`${command}\`, and this is the output of running that command instead:\n`);
            }
            else if (didToolEditCommand) {
                resultText.push(`Note: The tool simplified the command to \`${command}\`, and this is the output of running that command instead:\n`);
            }
            resultText.push(terminalResult);
            return {
                toolResultMessage,
                toolMetadata: {
                    exitCode: exitCode
                },
                content: [{
                        kind: 'text',
                        value: resultText.join(''),
                    }]
            };
        }
    }
    _handleTerminalVisibility(toolTerminal, chatSessionId) {
        const chatSessionOpenInWidget = !!this._chatWidgetService.getWidgetBySessionResource(LocalChatSessionUri.forSession(chatSessionId));
        if (this._configurationService.getValue("chat.tools.terminal.outputLocation" /* TerminalChatAgentToolsSettingId.OutputLocation */) === 'terminal' && chatSessionOpenInWidget) {
            this._terminalService.setActiveInstance(toolTerminal.instance);
            this._terminalService.revealTerminal(toolTerminal.instance, true);
        }
    }
    // #region Terminal init
    async _initBackgroundTerminal(chatSessionId, termId, terminalToolSessionId, token) {
        this._logService.debug(`RunInTerminalTool: Creating background terminal with ID=${termId}`);
        const profile = await this._profileFetcher.getCopilotProfile();
        const toolTerminal = await this._terminalToolCreator.createTerminal(profile, token);
        this._terminalChatService.registerTerminalInstanceWithToolSession(terminalToolSessionId, toolTerminal.instance);
        this._terminalChatService.registerTerminalInstanceWithChatSession(chatSessionId, toolTerminal.instance);
        this._registerInputListener(toolTerminal);
        this._sessionTerminalAssociations.set(chatSessionId, toolTerminal);
        if (token.isCancellationRequested) {
            toolTerminal.instance.dispose();
            throw new CancellationError();
        }
        await this._setupProcessIdAssociation(toolTerminal, chatSessionId, termId, true);
        return toolTerminal;
    }
    async _initForegroundTerminal(chatSessionId, termId, terminalToolSessionId, token) {
        const cachedTerminal = this._sessionTerminalAssociations.get(chatSessionId);
        if (cachedTerminal) {
            this._logService.debug(`RunInTerminalTool: Using cached foreground terminal with session ID \`${chatSessionId}\``);
            this._terminalToolCreator.refreshShellIntegrationQuality(cachedTerminal);
            this._terminalChatService.registerTerminalInstanceWithToolSession(terminalToolSessionId, cachedTerminal.instance);
            return cachedTerminal;
        }
        const profile = await this._profileFetcher.getCopilotProfile();
        const toolTerminal = await this._terminalToolCreator.createTerminal(profile, token);
        this._terminalChatService.registerTerminalInstanceWithToolSession(terminalToolSessionId, toolTerminal.instance);
        this._terminalChatService.registerTerminalInstanceWithChatSession(chatSessionId, toolTerminal.instance);
        this._registerInputListener(toolTerminal);
        this._sessionTerminalAssociations.set(chatSessionId, toolTerminal);
        if (token.isCancellationRequested) {
            toolTerminal.instance.dispose();
            throw new CancellationError();
        }
        await this._setupProcessIdAssociation(toolTerminal, chatSessionId, termId, false);
        return toolTerminal;
    }
    _registerInputListener(toolTerminal) {
        const disposable = toolTerminal.instance.onData(data => {
            if (!telemetryIgnoredSequences.includes(data)) {
                toolTerminal.receivedUserInput = data.length > 0;
            }
        });
        this._register(toolTerminal.instance.onDisposed(() => disposable.dispose()));
    }
    // #endregion
    // #region Session management
    _restoreTerminalAssociations() {
        const storedAssociations = this._storageService.get("chat.terminalSessions" /* TerminalToolStorageKeysInternal.TerminalSession */, 1 /* StorageScope.WORKSPACE */, '{}');
        try {
            const associations = JSON.parse(storedAssociations);
            // Find existing terminals and associate them with sessions
            for (const instance of this._terminalService.instances) {
                if (instance.processId) {
                    const association = associations[instance.processId];
                    if (association) {
                        this._logService.debug(`RunInTerminalTool: Restored terminal association for PID ${instance.processId}, session ${association.sessionId}`);
                        const toolTerminal = {
                            instance,
                            shellIntegrationQuality: association.shellIntegrationQuality
                        };
                        this._sessionTerminalAssociations.set(association.sessionId, toolTerminal);
                        this._terminalChatService.registerTerminalInstanceWithChatSession(association.sessionId, instance);
                        // Listen for terminal disposal to clean up storage
                        this._register(instance.onDisposed(() => {
                            this._removeProcessIdAssociation(instance.processId);
                        }));
                    }
                }
            }
        }
        catch (error) {
            this._logService.debug(`RunInTerminalTool: Failed to restore terminal associations: ${error}`);
        }
    }
    async _setupProcessIdAssociation(toolTerminal, chatSessionId, termId, isBackground) {
        await this._associateProcessIdWithSession(toolTerminal.instance, chatSessionId, termId, toolTerminal.shellIntegrationQuality, isBackground);
        this._register(toolTerminal.instance.onDisposed(() => {
            if (toolTerminal.instance.processId) {
                this._removeProcessIdAssociation(toolTerminal.instance.processId);
            }
        }));
    }
    async _associateProcessIdWithSession(terminal, sessionId, id, shellIntegrationQuality, isBackground) {
        try {
            // Wait for process ID with timeout
            const pid = await Promise.race([
                terminal.processReady.then(() => terminal.processId),
                timeout(5000).then(() => { throw new Error('Timeout'); })
            ]);
            if (isNumber(pid)) {
                const storedAssociations = this._storageService.get("chat.terminalSessions" /* TerminalToolStorageKeysInternal.TerminalSession */, 1 /* StorageScope.WORKSPACE */, '{}');
                const associations = JSON.parse(storedAssociations);
                const existingAssociation = associations[pid] || {};
                associations[pid] = {
                    ...existingAssociation,
                    sessionId,
                    shellIntegrationQuality,
                    id,
                    isBackground
                };
                this._storageService.store("chat.terminalSessions" /* TerminalToolStorageKeysInternal.TerminalSession */, JSON.stringify(associations), 1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */);
                this._logService.debug(`RunInTerminalTool: Associated terminal PID ${pid} with session ${sessionId}`);
            }
        }
        catch (error) {
            this._logService.debug(`RunInTerminalTool: Failed to associate terminal with session: ${error}`);
        }
    }
    async _removeProcessIdAssociation(pid) {
        try {
            const storedAssociations = this._storageService.get("chat.terminalSessions" /* TerminalToolStorageKeysInternal.TerminalSession */, 1 /* StorageScope.WORKSPACE */, '{}');
            const associations = JSON.parse(storedAssociations);
            if (associations[pid]) {
                delete associations[pid];
                this._storageService.store("chat.terminalSessions" /* TerminalToolStorageKeysInternal.TerminalSession */, JSON.stringify(associations), 1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */);
                this._logService.debug(`RunInTerminalTool: Removed terminal association for PID ${pid}`);
            }
        }
        catch (error) {
            this._logService.debug(`RunInTerminalTool: Failed to remove terminal association: ${error}`);
        }
    }
    _cleanupSessionTerminals(sessionId) {
        const toolTerminal = this._sessionTerminalAssociations.get(sessionId);
        if (toolTerminal) {
            this._logService.debug(`RunInTerminalTool: Cleaning up terminal for disposed chat session ${sessionId}`);
            this._sessionTerminalAssociations.delete(sessionId);
            toolTerminal.instance.dispose();
            // Clean up any background executions associated with this session
            const terminalToRemove = [];
            for (const [termId, execution] of RunInTerminalTool_1._backgroundExecutions.entries()) {
                if (execution.instance === toolTerminal.instance) {
                    execution.dispose();
                    terminalToRemove.push(termId);
                }
            }
            for (const termId of terminalToRemove) {
                RunInTerminalTool_1._backgroundExecutions.delete(termId);
            }
        }
    }
};
RunInTerminalTool = RunInTerminalTool_1 = __decorate([
    __param(0, IChatService),
    __param(1, IConfigurationService),
    __param(2, IHistoryService),
    __param(3, IInstantiationService),
    __param(4, ILanguageModelToolsService),
    __param(5, IRemoteAgentService),
    __param(6, IStorageService),
    __param(7, ITerminalChatService),
    __param(8, ITerminalLogService),
    __param(9, ITerminalService),
    __param(10, IWorkspaceContextService),
    __param(11, IChatWidgetService)
], RunInTerminalTool);
export { RunInTerminalTool };
class BackgroundTerminalExecution extends Disposable {
    constructor(instance, _xterm, _commandLine, sessionId, commandId) {
        super();
        this.instance = instance;
        this._xterm = _xterm;
        this._commandLine = _commandLine;
        this.sessionId = sessionId;
        this._startMarker = this._register(this._xterm.raw.registerMarker());
        this.instance.runCommand(this._commandLine, true, commandId);
    }
    getOutput(marker) {
        return getOutput(this.instance, marker ?? this._startMarker);
    }
}
let TerminalProfileFetcher = class TerminalProfileFetcher {
    constructor(_configurationService, _terminalProfileResolverService, _remoteAgentService) {
        this._configurationService = _configurationService;
        this._terminalProfileResolverService = _terminalProfileResolverService;
        this._remoteAgentService = _remoteAgentService;
        this.osBackend = this._remoteAgentService.getEnvironment().then(remoteEnv => remoteEnv?.os ?? OS);
    }
    async getCopilotProfile() {
        const os = await this.osBackend;
        // Check for chat agent terminal profile first
        const customChatAgentProfile = this._getChatTerminalProfile(os);
        if (customChatAgentProfile) {
            return customChatAgentProfile;
        }
        // When setting is null, use the previous behavior
        const defaultProfile = await this._terminalProfileResolverService.getDefaultProfile({
            os,
            remoteAuthority: this._remoteAgentService.getConnection()?.remoteAuthority
        });
        // Force pwsh over cmd as cmd doesn't have shell integration
        if (basename(defaultProfile.path) === 'cmd.exe') {
            return {
                ...defaultProfile,
                path: 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
                profileName: 'PowerShell'
            };
        }
        // Setting icon: undefined allows the system to use the default AI terminal icon (not overridden or removed)
        return { ...defaultProfile, icon: undefined };
    }
    async getCopilotShell() {
        return (await this.getCopilotProfile()).path;
    }
    _getChatTerminalProfile(os) {
        let profileSetting;
        switch (os) {
            case 1 /* OperatingSystem.Windows */:
                profileSetting = "chat.tools.terminal.terminalProfile.windows" /* TerminalChatAgentToolsSettingId.TerminalProfileWindows */;
                break;
            case 2 /* OperatingSystem.Macintosh */:
                profileSetting = "chat.tools.terminal.terminalProfile.osx" /* TerminalChatAgentToolsSettingId.TerminalProfileMacOs */;
                break;
            case 3 /* OperatingSystem.Linux */:
            default:
                profileSetting = "chat.tools.terminal.terminalProfile.linux" /* TerminalChatAgentToolsSettingId.TerminalProfileLinux */;
                break;
        }
        const profile = this._configurationService.getValue(profileSetting);
        if (this._isValidChatAgentTerminalProfile(profile)) {
            return profile;
        }
        return undefined;
    }
    _isValidChatAgentTerminalProfile(profile) {
        if (profile === null || profile === undefined || typeof profile !== 'object') {
            return false;
        }
        if ('path' in profile && isString(profile.path)) {
            return true;
        }
        return false;
    }
};
TerminalProfileFetcher = __decorate([
    __param(0, IConfigurationService),
    __param(1, ITerminalProfileResolverService),
    __param(2, IRemoteAgentService)
], TerminalProfileFetcher);
export { TerminalProfileFetcher };
// #endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuSW5UZXJtaW5hbFRvb2wuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdG9vbHMvcnVuSW5UZXJtaW5hbFRvb2wudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxjQUFjLEVBQXdCLE1BQU0sOENBQThDLENBQUM7QUFDcEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN6RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDakUsT0FBTyxFQUFtQixFQUFFLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNoRixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDakUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUscUJBQXFCLEVBQXlCLE1BQU0sa0VBQWtFLENBQUM7QUFDaEksT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxzREFBc0QsQ0FBQztBQUVwSCxPQUFPLEVBQUUsbUJBQW1CLEVBQW9CLE1BQU0sd0RBQXdE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