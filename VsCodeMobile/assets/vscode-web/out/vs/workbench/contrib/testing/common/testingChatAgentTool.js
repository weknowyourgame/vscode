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
import { disposableTimeout, RunOnceScheduler } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { basename, isAbsolute } from '../../../../base/common/path.js';
import { isDefined } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ILanguageModelToolsService, ToolDataSource, } from '../../chat/common/languageModelToolsService.js';
import { TestId } from './testId.js';
import { getTotalCoveragePercent } from './testCoverage.js';
import { TestingContextKeys } from './testingContextKeys.js';
import { collectTestStateCounts, getTestProgressText } from './testingProgressMessages.js';
import { isFailedState } from './testingStates.js';
import { ITestResultService } from './testResultService.js';
import { ITestService, testsInFile, waitForTestToBeIdle } from './testService.js';
import { Position } from '../../../../editor/common/core/position.js';
import { ITestProfileService } from './testProfileService.js';
let TestingChatAgentToolContribution = class TestingChatAgentToolContribution extends Disposable {
    static { this.ID = 'workbench.contrib.testing.chatAgentTool'; }
    constructor(instantiationService, toolsService, contextKeyService) {
        super();
        const runTestsTool = instantiationService.createInstance(RunTestTool);
        this._register(toolsService.registerTool(RunTestTool.DEFINITION, runTestsTool));
        this._register(toolsService.executeToolSet.addTool(RunTestTool.DEFINITION));
        // todo@connor4312: temporary for 1.103 release during changeover
        contextKeyService.createKey('chat.coreTestFailureToolEnabled', true).set(true);
    }
};
TestingChatAgentToolContribution = __decorate([
    __param(0, IInstantiationService),
    __param(1, ILanguageModelToolsService),
    __param(2, IContextKeyService)
], TestingChatAgentToolContribution);
export { TestingChatAgentToolContribution };
let RunTestTool = class RunTestTool {
    static { this.ID = 'runTests'; }
    static { this.DEFINITION = {
        id: this.ID,
        toolReferenceName: 'runTests',
        legacyToolReferenceFullNames: ['runTests'],
        when: TestingContextKeys.hasRunnableTests,
        displayName: 'Run tests',
        modelDescription: 'Runs unit tests in files. Use this tool if the user asks to run tests or when you want to validate changes using unit tests, and prefer using this tool instead of the terminal tool. When possible, always try to provide `files` paths containing the relevant unit tests in order to avoid unnecessarily long test runs. This tool outputs detailed information about the results of the test run. Set mode="coverage" to also collect coverage and optionally provide coverageFiles for focused reporting.',
        icon: Codicon.beaker,
        inputSchema: {
            type: 'object',
            properties: {
                files: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Absolute paths to the test files to run. If not provided, all test files will be run.',
                },
                testNames: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'An array of test names to run. Depending on the context, test names defined in code may be strings or the names of functions or classes containing the test cases. If not provided, all tests in the files will be run.',
                },
                mode: {
                    type: 'string',
                    enum: ['run', 'coverage'],
                    description: 'Execution mode: "run" (default) runs tests normally, "coverage" collects coverage.',
                },
                coverageFiles: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'When mode="coverage": absolute file paths to include detailed coverage info for. Only the first matching file will be summarized.'
                }
            },
        },
        userDescription: localize('runTestTool.userDescription', 'Run unit tests (optionally with coverage)'),
        source: ToolDataSource.Internal,
        tags: [
            'vscode_editing_with_tests',
            'enable_other_tool_copilot_readFile',
            'enable_other_tool_copilot_listDirectory',
            'enable_other_tool_copilot_findFiles',
            'enable_other_tool_copilot_runTests',
            'enable_other_tool_copilot_runTestsWithCoverage',
            'enable_other_tool_copilot_testFailure',
        ],
    }; }
    constructor(_testService, _uriIdentityService, _workspaceContextService, _testResultService, _testProfileService) {
        this._testService = _testService;
        this._uriIdentityService = _uriIdentityService;
        this._workspaceContextService = _workspaceContextService;
        this._testResultService = _testResultService;
        this._testProfileService = _testProfileService;
    }
    async invoke(invocation, countTokens, progress, token) {
        const params = invocation.parameters;
        const mode = (params.mode === 'coverage' ? 'coverage' : 'run');
        let group = (mode === 'coverage' ? 8 /* TestRunProfileBitset.Coverage */ : 2 /* TestRunProfileBitset.Run */);
        const coverageFiles = (mode === 'coverage' ? (params.coverageFiles && params.coverageFiles.length ? params.coverageFiles : undefined) : undefined);
        const testFiles = await this._getFileTestsToRun(params, progress);
        const testCases = await this._getTestCasesToRun(params, testFiles, progress);
        if (!testCases.length) {
            return {
                content: [{ kind: 'text', value: 'No tests found in the files. Ensure the correct absolute paths are passed to the tool.' }],
                toolResultError: localize('runTestTool.noTests', 'No tests found in the files'),
            };
        }
        progress.report({ message: localize('runTestTool.invoke.progress', 'Starting test run...') });
        // If the model asks for coverage but the test provider doesn't support it, use normal 'run' mode
        if (group === 8 /* TestRunProfileBitset.Coverage */) {
            if (!testCases.some(tc => this._testProfileService.capabilitiesForTest(tc.item) & 8 /* TestRunProfileBitset.Coverage */)) {
                group = 2 /* TestRunProfileBitset.Run */;
            }
        }
        const result = await this._captureTestResult(testCases, group, token);
        if (!result) {
            return {
                content: [{ kind: 'text', value: 'No test run was started. Instruct the user to ensure their test runner is correctly configured' }],
                toolResultError: localize('runTestTool.noRunStarted', 'No test run was started. This may be an issue with your test runner or extension.'),
            };
        }
        await this._monitorRunProgress(result, progress, token);
        if (token.isCancellationRequested) {
            this._testService.cancelTestRun(result.id);
            return {
                content: [{ kind: 'text', value: localize('runTestTool.invoke.cancelled', 'Test run was cancelled.') }],
                toolResultMessage: localize('runTestTool.invoke.cancelled', 'Test run was cancelled.'),
            };
        }
        const summary = await this._buildSummary(result, mode, coverageFiles);
        const content = [{ kind: 'text', value: summary }];
        return {
            content: content,
            toolResultMessage: getTestProgressText(collectTestStateCounts(false, [result])),
        };
    }
    async _buildSummary(result, mode, coverageFiles) {
        const failures = result.counts[6 /* TestResultState.Errored */] + result.counts[4 /* TestResultState.Failed */];
        let str = `<summary passed=${result.counts[3 /* TestResultState.Passed */]} failed=${failures} />\n`;
        if (failures !== 0) {
            str += await this._getFailureDetails(result);
        }
        if (mode === 'coverage') {
            str += await this._getCoverageSummary(result, coverageFiles);
        }
        return str;
    }
    async _getCoverageSummary(result, coverageFiles) {
        if (!coverageFiles || !coverageFiles.length) {
            return '';
        }
        for (const task of result.tasks) {
            const coverage = task.coverage.get();
            if (!coverage) {
                continue;
            }
            const normalized = coverageFiles.map(file => URI.file(file).fsPath);
            const coveredFilesMap = new Map();
            for (const file of coverage.getAllFiles().values()) {
                coveredFilesMap.set(file.uri.fsPath, file);
            }
            for (const path of normalized) {
                const file = coveredFilesMap.get(path);
                if (!file) {
                    continue;
                }
                let summary = `<coverage task=${JSON.stringify(task.name || '')}>\n`;
                const pct = getTotalCoveragePercent(file.statement, file.branch, file.declaration) * 100;
                summary += `<firstUncoveredFile path=${JSON.stringify(path)} statementsCovered=${file.statement.covered} statementsTotal=${file.statement.total}`;
                if (file.branch) {
                    summary += ` branchesCovered=${file.branch.covered} branchesTotal=${file.branch.total}`;
                }
                if (file.declaration) {
                    summary += ` declarationsCovered=${file.declaration.covered} declarationsTotal=${file.declaration.total}`;
                }
                summary += ` percent=${pct.toFixed(2)}`;
                try {
                    const details = await file.details();
                    for (const detail of details) {
                        if (detail.count || !detail.location) {
                            continue;
                        }
                        let startLine;
                        let endLine;
                        if (Position.isIPosition(detail.location)) {
                            startLine = endLine = detail.location.lineNumber;
                        }
                        else {
                            startLine = detail.location.startLineNumber;
                            endLine = detail.location.endLineNumber;
                        }
                        summary += ` firstUncoveredStart=${startLine} firstUncoveredEnd=${endLine}`;
                        break;
                    }
                }
                catch { /* ignore */ }
                summary += ` />\n`;
                summary += `</coverage>\n`;
                return summary;
            }
        }
        return '';
    }
    async _getFailureDetails(result) {
        let str = '';
        let hadMessages = false;
        for (const failure of result.tests) {
            if (!isFailedState(failure.ownComputedState)) {
                continue;
            }
            const [, ...testPath] = TestId.split(failure.item.extId);
            const testName = testPath.pop();
            str += `<testFailure name=${JSON.stringify(testName)} path=${JSON.stringify(testPath.join(' > '))}>\n`;
            // Extract detailed failure information from error messages
            for (const task of failure.tasks) {
                for (const message of task.messages.filter(m => m.type === 0 /* TestMessageType.Error */)) {
                    hadMessages = true;
                    // Add expected/actual outputs if available
                    if (message.expected !== undefined && message.actual !== undefined) {
                        str += `<expectedOutput>\n${message.expected}\n</expectedOutput>\n`;
                        str += `<actualOutput>\n${message.actual}\n</actualOutput>\n`;
                    }
                    else {
                        // Fallback to the message content
                        const messageText = typeof message.message === 'string' ? message.message : message.message.value;
                        str += `<message>\n${messageText}\n</message>\n`;
                    }
                    // Add stack trace information if available (limit to first 10 frames)
                    if (message.stackTrace && message.stackTrace.length > 0) {
                        for (const frame of message.stackTrace.slice(0, 10)) {
                            if (frame.uri && frame.position) {
                                str += `<stackFrame path="${frame.uri.fsPath}" line="${frame.position.lineNumber}" col="${frame.position.column}" />\n`;
                            }
                            else if (frame.uri) {
                                str += `<stackFrame path="${frame.uri.fsPath}">${frame.label}</stackFrame>\n`;
                            }
                            else {
                                str += `<stackFrame>${frame.label}</stackFrame>\n`;
                            }
                        }
                    }
                    // Add location information if available
                    if (message.location) {
                        str += `<location path="${message.location.uri.fsPath}" line="${message.location.range.startLineNumber}" col="${message.location.range.startColumn}" />\n`;
                    }
                }
            }
            str += `</testFailure>\n`;
        }
        if (!hadMessages) { // some adapters don't have any per-test messages and just output
            const output = result.tasks.map(t => t.output.getRange(0, t.output.length).toString().trim()).join('\n');
            if (output) {
                str += `<output>\n${output}\n</output>\n`;
            }
        }
        return str;
    }
    /** Updates the UI progress as the test runs, resolving when the run is finished. */
    async _monitorRunProgress(result, progress, token) {
        const store = new DisposableStore();
        const update = () => {
            const counts = collectTestStateCounts(!result.completedAt, [result]);
            const text = getTestProgressText(counts);
            progress.report({ message: text, progress: counts.runSoFar / counts.totalWillBeRun });
        };
        const throttler = store.add(new RunOnceScheduler(update, 500));
        return new Promise(resolve => {
            store.add(result.onChange(() => {
                if (!throttler.isScheduled) {
                    throttler.schedule();
                }
            }));
            store.add(token.onCancellationRequested(() => {
                this._testService.cancelTestRun(result.id);
                resolve();
            }));
            store.add(result.onComplete(() => {
                update();
                resolve();
            }));
        }).finally(() => store.dispose());
    }
    /**
     * Captures the test result. This is a little tricky because some extensions
     * trigger an 'out of bound' test run, so we actually wait for the first
     * test run to come in that contains one or more tasks and treat that as the
     * one we're looking for.
     */
    async _captureTestResult(testCases, group, token) {
        const store = new DisposableStore();
        const onDidTimeout = store.add(new Emitter());
        return new Promise(resolve => {
            store.add(onDidTimeout.event(() => {
                resolve(undefined);
            }));
            store.add(this._testResultService.onResultsChanged(ev => {
                if ('started' in ev) {
                    store.add(ev.started.onNewTask(() => {
                        store.dispose();
                        resolve(ev.started);
                    }));
                }
            }));
            this._testService.runTests({
                group,
                tests: testCases,
                preserveFocus: true,
            }, token).then(() => {
                if (!store.isDisposed) {
                    store.add(disposableTimeout(() => onDidTimeout.fire(), 5_000));
                }
            });
        }).finally(() => store.dispose());
    }
    /** Filters the test files to individual test cases based on the provided parameters. */
    async _getTestCasesToRun(params, tests, progress) {
        if (!params.testNames?.length) {
            return tests;
        }
        progress.report({ message: localize('runTestTool.invoke.filterProgress', 'Filtering tests...') });
        const testNames = params.testNames.map(t => t.toLowerCase().trim());
        const filtered = [];
        const doFilter = async (test) => {
            const name = test.item.label.toLowerCase().trim();
            if (testNames.some(tn => name.includes(tn))) {
                filtered.push(test);
                return;
            }
            if (test.expand === 1 /* TestItemExpandState.Expandable */) {
                await this._testService.collection.expand(test.item.extId, 1);
            }
            await waitForTestToBeIdle(this._testService, test);
            await Promise.all([...test.children].map(async (id) => {
                const item = this._testService.collection.getNodeById(id);
                if (item) {
                    await doFilter(item);
                }
            }));
        };
        await Promise.all(tests.map(doFilter));
        return filtered;
    }
    /** Gets the file tests to run based on the provided parameters. */
    async _getFileTestsToRun(params, progress) {
        if (!params.files?.length) {
            return [...this._testService.collection.rootItems];
        }
        progress.report({ message: localize('runTestTool.invoke.filesProgress', 'Discovering tests...') });
        const firstWorkspaceFolder = this._workspaceContextService.getWorkspace().folders.at(0)?.uri;
        const uris = params.files.map(f => {
            if (isAbsolute(f)) {
                return URI.file(f);
            }
            else if (firstWorkspaceFolder) {
                return URI.joinPath(firstWorkspaceFolder, f);
            }
            else {
                return undefined;
            }
        }).filter(isDefined);
        const tests = [];
        for (const uri of uris) {
            for await (const files of testsInFile(this._testService, this._uriIdentityService, uri, undefined, false)) {
                for (const file of files) {
                    tests.push(file);
                }
            }
        }
        return tests;
    }
    prepareToolInvocation(context, token) {
        const params = context.parameters;
        const title = localize('runTestTool.confirm.title', 'Allow test run?');
        const inFiles = params.files?.map((f) => '`' + basename(f) + '`');
        return Promise.resolve({
            invocationMessage: localize('runTestTool.confirm.invocation', 'Running tests...'),
            confirmationMessages: {
                title,
                message: inFiles?.length
                    ? new MarkdownString().appendMarkdown(localize('runTestTool.confirm.message', 'The model wants to run tests in {0}.', inFiles.join(', ')))
                    : localize('runTestTool.confirm.all', 'The model wants to run all tests.'),
                allowAutoConfirm: true,
            },
        });
    }
};
RunTestTool = __decorate([
    __param(0, ITestService),
    __param(1, IUriIdentityService),
    __param(2, IWorkspaceContextService),
    __param(3, ITestResultService),
    __param(4, ITestProfileService)
], RunTestTool);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGluZ0NoYXRBZ2VudFRvb2wuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVzdGluZy9jb21tb24vdGVzdGluZ0NoYXRBZ2VudFRvb2wudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFdkYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxTQUFTLEVBQVcsTUFBTSxrQ0FBa0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRTlGLE9BQU8sRUFFTiwwQkFBMEIsRUFPMUIsY0FBYyxHQUVkLE1BQU0sZ0RBQWdELENBQUM7QUFDeEQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFN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