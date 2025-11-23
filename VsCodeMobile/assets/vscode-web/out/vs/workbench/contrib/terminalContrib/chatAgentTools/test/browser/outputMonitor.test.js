/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { detectsInputRequiredPattern, OutputMonitor } from '../../browser/tools/monitoring/outputMonitor.js';
import { CancellationTokenSource } from '../../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { OutputMonitorState } from '../../browser/tools/monitoring/types.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILanguageModelsService } from '../../../../chat/common/languageModels.js';
import { IChatService } from '../../../../chat/common/chatService.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { ChatModel } from '../../../../chat/common/chatModel.js';
import { ILogService, NullLogService } from '../../../../../../platform/log/common/log.js';
import { runWithFakedTimers } from '../../../../../../base/test/common/timeTravelScheduler.js';
import { LocalChatSessionUri } from '../../../../chat/common/chatUri.js';
import { isNumber } from '../../../../../../base/common/types.js';
suite('OutputMonitor', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let monitor;
    let execution;
    let cts;
    let instantiationService;
    let sendTextCalled;
    let dataEmitter;
    setup(() => {
        sendTextCalled = false;
        dataEmitter = new Emitter();
        execution = {
            getOutput: () => 'test output',
            isActive: async () => false,
            instance: {
                instanceId: 1,
                sendText: async () => { sendTextCalled = true; },
                onDidInputData: dataEmitter.event,
                onDisposed: Event.None,
                onData: dataEmitter.event,
                focus: () => { },
                // eslint-disable-next-line local/code-no-any-casts
                registerMarker: () => ({ id: 1 })
            },
            sessionId: '1'
        };
        instantiationService = new TestInstantiationService();
        instantiationService.stub(ILanguageModelsService, {
            selectLanguageModels: async () => []
        });
        instantiationService.stub(IChatService, {
            // eslint-disable-next-line local/code-no-any-casts
            getSession: () => ({
                sessionId: '1',
                onDidDispose: { event: () => { }, dispose: () => { } },
                onDidChange: { event: () => { }, dispose: () => { } },
                initialLocation: undefined,
                requests: [],
                responses: [],
                addRequest: () => { },
                addResponse: () => { },
                dispose: () => { }
            })
        });
        instantiationService.stub(ILogService, new NullLogService());
        cts = new CancellationTokenSource();
    });
    teardown(() => {
        cts.dispose();
    });
    test('startMonitoring returns immediately when polling succeeds', async () => {
        return runWithFakedTimers({}, async () => {
            // Simulate output change after first poll
            let callCount = 0;
            execution.getOutput = () => {
                callCount++;
                return callCount > 1 ? 'changed output' : 'test output';
            };
            monitor = store.add(instantiationService.createInstance(OutputMonitor, execution, undefined, createTestContext('1'), cts.token, 'test command'));
            await Event.toPromise(monitor.onDidFinishCommand);
            const pollingResult = monitor.pollingResult;
            assert.strictEqual(pollingResult?.state, OutputMonitorState.Idle);
            assert.strictEqual(pollingResult.output, 'changed output');
            assert.strictEqual(sendTextCalled, false, 'sendText should not be called');
        });
    });
    test('startMonitoring returns cancelled when token is cancelled', async () => {
        return runWithFakedTimers({}, async () => {
            monitor = store.add(instantiationService.createInstance(OutputMonitor, execution, undefined, createTestContext('1'), cts.token, 'test command'));
            cts.cancel();
            await Event.toPromise(monitor.onDidFinishCommand);
            const pollingResult = monitor.pollingResult;
            assert.strictEqual(pollingResult?.state, OutputMonitorState.Cancelled);
        });
    });
    test('startMonitoring returns idle when isActive is false', async () => {
        return runWithFakedTimers({}, async () => {
            execution.isActive = async () => false;
            monitor = store.add(instantiationService.createInstance(OutputMonitor, execution, undefined, createTestContext('1'), cts.token, 'test command'));
            await Event.toPromise(monitor.onDidFinishCommand);
            const pollingResult = monitor.pollingResult;
            assert.strictEqual(pollingResult?.state, OutputMonitorState.Idle);
        });
    });
    test('startMonitoring works when isActive is undefined', async () => {
        return runWithFakedTimers({}, async () => {
            // Simulate output change after first poll
            let callCount = 0;
            execution.getOutput = () => {
                callCount++;
                return callCount > 1 ? 'changed output' : 'test output';
            };
            delete execution.isActive;
            monitor = store.add(instantiationService.createInstance(OutputMonitor, execution, undefined, createTestContext('1'), cts.token, 'test command'));
            await Event.toPromise(monitor.onDidFinishCommand);
            const pollingResult = monitor.pollingResult;
            assert.strictEqual(pollingResult?.state, OutputMonitorState.Idle);
        });
    });
    test('monitor can be disposed twice without error', async () => {
        return runWithFakedTimers({}, async () => {
            // Simulate output change after first poll
            let callCount = 0;
            execution.getOutput = () => {
                callCount++;
                return callCount > 1 ? 'changed output' : 'test output';
            };
            monitor = store.add(instantiationService.createInstance(OutputMonitor, execution, undefined, createTestContext('1'), cts.token, 'test command'));
            await Event.toPromise(monitor.onDidFinishCommand);
            const pollingResult = monitor.pollingResult;
            assert.strictEqual(pollingResult?.state, OutputMonitorState.Idle);
            monitor.dispose();
            monitor.dispose();
        });
    });
    test('timeout prompt unanswered → continues polling and completes when idle', async () => {
        return runWithFakedTimers({}, async () => {
            // Fake a ChatModel enough to pass instanceof and the two methods used
            const fakeChatModel = {
                getRequests: () => [{}],
                acceptResponseProgress: () => { }
            };
            Object.setPrototypeOf(fakeChatModel, ChatModel.prototype);
            instantiationService.stub(IChatService, { getSession: () => fakeChatModel });
            // Poller: first pass times out (to show the prompt), second pass goes idle
            let pass = 0;
            const timeoutThenIdle = async () => {
                pass++;
                return pass === 1
                    ? { state: OutputMonitorState.Timeout, output: execution.getOutput(), modelOutputEvalResponse: 'Timed out' }
                    : { state: OutputMonitorState.Idle, output: execution.getOutput(), modelOutputEvalResponse: 'Done' };
            };
            monitor = store.add(instantiationService.createInstance(OutputMonitor, execution, timeoutThenIdle, createTestContext('1'), cts.token, 'test command'));
            await Event.toPromise(monitor.onDidFinishCommand);
            const res = monitor.pollingResult;
            assert.strictEqual(res.state, OutputMonitorState.Idle);
            assert.strictEqual(res.output, 'test output');
            assert.ok(isNumber(res.pollDurationMs));
        });
    });
    suite('detectsInputRequiredPattern', () => {
        test('detects yes/no confirmation prompts (pairs and variants)', () => {
            assert.strictEqual(detectsInputRequiredPattern('Continue? (y/N) '), true);
            assert.strictEqual(detectsInputRequiredPattern('Continue? (y/n) '), true);
            assert.strictEqual(detectsInputRequiredPattern('Overwrite file? [Y/n] '), true);
            assert.strictEqual(detectsInputRequiredPattern('Are you sure? (Y/N) '), true);
            assert.strictEqual(detectsInputRequiredPattern('Delete files? [y/N] '), true);
            assert.strictEqual(detectsInputRequiredPattern('Proceed? (yes/no) '), true);
            assert.strictEqual(detectsInputRequiredPattern('Proceed? [no/yes] '), true);
            assert.strictEqual(detectsInputRequiredPattern('Continue? y/n '), true);
            assert.strictEqual(detectsInputRequiredPattern('Overwrite: yes/no '), true);
            // No match if there's a response already
            assert.strictEqual(detectsInputRequiredPattern('Continue? (y/N) y'), false);
            assert.strictEqual(detectsInputRequiredPattern('Continue? (y/n) n'), false);
            assert.strictEqual(detectsInputRequiredPattern('Overwrite file? [Y/n] N'), false);
            assert.strictEqual(detectsInputRequiredPattern('Are you sure? (Y/N) Y'), false);
            assert.strictEqual(detectsInputRequiredPattern('Delete files? [y/N] y'), false);
            assert.strictEqual(detectsInputRequiredPattern('Continue? y/n y\/n'), false);
            assert.strictEqual(detectsInputRequiredPattern('Overwrite: yes/no yes\/n'), false);
        });
        test('detects PowerShell multi-option confirmation line', () => {
            assert.strictEqual(detectsInputRequiredPattern('[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is "Y"): '), true);
            // also matches without default suffix
            assert.strictEqual(detectsInputRequiredPattern('[Y] Yes  [N] No '), true);
            // No match if there's a response already
            assert.strictEqual(detectsInputRequiredPattern('[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is "Y"): Y'), false);
            assert.strictEqual(detectsInputRequiredPattern('[Y] Yes  [N] No N'), false);
        });
        test('Line ends with colon', () => {
            assert.strictEqual(detectsInputRequiredPattern('Enter your name: '), true);
            assert.strictEqual(detectsInputRequiredPattern('Password: '), true);
            assert.strictEqual(detectsInputRequiredPattern('File to overwrite: '), true);
        });
        test('detects trailing questions', () => {
            assert.strictEqual(detectsInputRequiredPattern('Continue?'), true);
            assert.strictEqual(detectsInputRequiredPattern('Proceed?   '), true);
            assert.strictEqual(detectsInputRequiredPattern('Are you sure?'), true);
        });
        test('detects press any key prompts', () => {
            assert.strictEqual(detectsInputRequiredPattern('Press any key to continue...'), true);
            assert.strictEqual(detectsInputRequiredPattern('Press a key'), true);
        });
    });
});
function createTestContext(id) {
    return { sessionId: id, sessionResource: LocalChatSessionUri.forSession(id) };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0TW9uaXRvci50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0QWdlbnRUb29scy90ZXN0L2Jyb3dzZXIvb3V0cHV0TW9uaXRvci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQ2pDLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxhQUFhLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUM3RyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN4RixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUV0RyxPQUFPLEVBQWtCLGtCQUFrQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDN0YsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sa0ZBQWtGLENBQUM7QUFDNUgsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbkYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDM0YsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFFL0YsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDekUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRWxFLEtBQUssQ0FBQyxlQUFlLEVBQUUsR0FB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