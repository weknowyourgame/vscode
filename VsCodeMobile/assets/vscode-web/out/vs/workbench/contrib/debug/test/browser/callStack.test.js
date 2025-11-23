/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import * as sinon from 'sinon';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { upcastDeepPartial, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { TestAccessibilityService } from '../../../../../platform/accessibility/test/common/testAccessibilityService.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { createDecorationsForStackFrame } from '../../browser/callStackEditorContribution.js';
import { getContext, getContextForContributedActions, getSpecificSourceName } from '../../browser/callStackView.js';
import { debugStackframe, debugStackframeFocused } from '../../browser/debugIcons.js';
import { getStackFrameThreadAndSessionToFocus } from '../../browser/debugService.js';
import { DebugSession } from '../../browser/debugSession.js';
import { StackFrame, Thread } from '../../common/debugModel.js';
import { Source } from '../../common/debugSource.js';
import { MockRawSession } from '../common/mockDebug.js';
import { createMockDebugModel, mockUriIdentityService } from './mockDebugModel.js';
const mockWorkspaceContextService = upcastDeepPartial({
    getWorkspace: () => {
        return {
            folders: []
        };
    }
});
export function createTestSession(model, name = 'mockSession', options) {
    return new DebugSession(generateUuid(), { resolved: { name, type: 'node', request: 'launch' }, unresolved: undefined }, undefined, model, options, {
        getViewModel() {
            return {
                updateViews() {
                    // noop
                }
            };
        }
    }, undefined, undefined, new TestConfigurationService({ debug: { console: { collapseIdenticalLines: true } } }), undefined, mockWorkspaceContextService, undefined, undefined, undefined, mockUriIdentityService, new TestInstantiationService(), undefined, undefined, new NullLogService(), undefined, undefined, new TestAccessibilityService());
}
function createTwoStackFrames(session) {
    const thread = new class extends Thread {
        getCallStack() {
            return [firstStackFrame, secondStackFrame];
        }
    }(session, 'mockthread', 1);
    const firstSource = new Source({
        name: 'internalModule.js',
        path: 'a/b/c/d/internalModule.js',
        sourceReference: 10,
    }, 'aDebugSessionId', mockUriIdentityService, new NullLogService());
    const secondSource = new Source({
        name: 'internalModule.js',
        path: 'z/x/c/d/internalModule.js',
        sourceReference: 11,
    }, 'aDebugSessionId', mockUriIdentityService, new NullLogService());
    const firstStackFrame = new StackFrame(thread, 0, firstSource, 'app.js', 'normal', { startLineNumber: 1, startColumn: 2, endLineNumber: 1, endColumn: 10 }, 0, true);
    const secondStackFrame = new StackFrame(thread, 1, secondSource, 'app2.js', 'normal', { startLineNumber: 1, startColumn: 2, endLineNumber: 1, endColumn: 10 }, 1, true);
    return { firstStackFrame, secondStackFrame };
}
suite('Debug - CallStack', () => {
    let model;
    let mockRawSession;
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    setup(() => {
        model = createMockDebugModel(disposables);
        mockRawSession = new MockRawSession();
    });
    teardown(() => {
        sinon.restore();
    });
    // Threads
    test('threads simple', () => {
        const threadId = 1;
        const threadName = 'firstThread';
        const session = createTestSession(model);
        disposables.add(session);
        model.addSession(session);
        assert.strictEqual(model.getSessions(true).length, 1);
        model.rawUpdate({
            sessionId: session.getId(),
            threads: [{
                    id: threadId,
                    name: threadName
                }]
        });
        assert.strictEqual(session.getThread(threadId).name, threadName);
        model.clearThreads(session.getId(), true);
        assert.strictEqual(session.getThread(threadId), undefined);
        assert.strictEqual(model.getSessions(true).length, 1);
    });
    test('threads multiple with allThreadsStopped', async () => {
        const threadId1 = 1;
        const threadName1 = 'firstThread';
        const threadId2 = 2;
        const threadName2 = 'secondThread';
        const stoppedReason = 'breakpoint';
        // Add the threads
        const session = createTestSession(model);
        disposables.add(session);
        model.addSession(session);
        session.raw = upcastPartial(mockRawSession);
        model.rawUpdate({
            sessionId: session.getId(),
            threads: [{
                    id: threadId1,
                    name: threadName1
                }]
        });
        // Stopped event with all threads stopped
        model.rawUpdate({
            sessionId: session.getId(),
            threads: [{
                    id: threadId1,
                    name: threadName1
                }, {
                    id: threadId2,
                    name: threadName2
                }],
            stoppedDetails: {
                reason: stoppedReason,
                threadId: 1,
                allThreadsStopped: true
            },
        });
        const thread1 = session.getThread(threadId1);
        const thread2 = session.getThread(threadId2);
        // at the beginning, callstacks are obtainable but not available
        assert.strictEqual(session.getAllThreads().length, 2);
        assert.strictEqual(thread1.name, threadName1);
        assert.strictEqual(thread1.stopped, true);
        assert.strictEqual(thread1.getCallStack().length, 0);
        assert.strictEqual(thread1.stoppedDetails.reason, stoppedReason);
        assert.strictEqual(thread2.name, threadName2);
        assert.strictEqual(thread2.stopped, true);
        assert.strictEqual(thread2.getCallStack().length, 0);
        assert.strictEqual(thread2.stoppedDetails.reason, undefined);
        // after calling getCallStack, the callstack becomes available
        // and results in a request for the callstack in the debug adapter
        await thread1.fetchCallStack();
        assert.notStrictEqual(thread1.getCallStack().length, 0);
        await thread2.fetchCallStack();
        assert.notStrictEqual(thread2.getCallStack().length, 0);
        // calling multiple times getCallStack doesn't result in multiple calls
        // to the debug adapter
        await thread1.fetchCallStack();
        await thread2.fetchCallStack();
        // clearing the callstack results in the callstack not being available
        thread1.clearCallStack();
        assert.strictEqual(thread1.stopped, true);
        assert.strictEqual(thread1.getCallStack().length, 0);
        thread2.clearCallStack();
        assert.strictEqual(thread2.stopped, true);
        assert.strictEqual(thread2.getCallStack().length, 0);
        model.clearThreads(session.getId(), true);
        assert.strictEqual(session.getThread(threadId1), undefined);
        assert.strictEqual(session.getThread(threadId2), undefined);
        assert.strictEqual(session.getAllThreads().length, 0);
    });
    test('allThreadsStopped in multiple events', async () => {
        const threadId1 = 1;
        const threadName1 = 'firstThread';
        const threadId2 = 2;
        const threadName2 = 'secondThread';
        const stoppedReason = 'breakpoint';
        // Add the threads
        const session = createTestSession(model);
        disposables.add(session);
        model.addSession(session);
        session.raw = upcastPartial(mockRawSession);
        // Stopped event with all threads stopped
        model.rawUpdate({
            sessionId: session.getId(),
            threads: [{
                    id: threadId1,
                    name: threadName1
                }, {
                    id: threadId2,
                    name: threadName2
                }],
            stoppedDetails: {
                reason: stoppedReason,
                threadId: threadId1,
                allThreadsStopped: true
            },
        });
        model.rawUpdate({
            sessionId: session.getId(),
            threads: [{
                    id: threadId1,
                    name: threadName1
                }, {
                    id: threadId2,
                    name: threadName2
                }],
            stoppedDetails: {
                reason: stoppedReason,
                threadId: threadId2,
                allThreadsStopped: true
            },
        });
        const thread1 = session.getThread(threadId1);
        const thread2 = session.getThread(threadId2);
        assert.strictEqual(thread1.stoppedDetails?.reason, stoppedReason);
        assert.strictEqual(thread2.stoppedDetails?.reason, stoppedReason);
    });
    test('threads multiple without allThreadsStopped', async () => {
        const sessionStub = sinon.spy(mockRawSession, 'stackTrace');
        const stoppedThreadId = 1;
        const stoppedThreadName = 'stoppedThread';
        const runningThreadId = 2;
        const runningThreadName = 'runningThread';
        const stoppedReason = 'breakpoint';
        const session = createTestSession(model);
        disposables.add(session);
        model.addSession(session);
        session.raw = upcastPartial(mockRawSession);
        // Add the threads
        model.rawUpdate({
            sessionId: session.getId(),
            threads: [{
                    id: stoppedThreadId,
                    name: stoppedThreadName
                }]
        });
        // Stopped event with only one thread stopped
        model.rawUpdate({
            sessionId: session.getId(),
            threads: [{
                    id: 1,
                    name: stoppedThreadName
                }, {
                    id: runningThreadId,
                    name: runningThreadName
                }],
            stoppedDetails: {
                reason: stoppedReason,
                threadId: 1,
                allThreadsStopped: false
            }
        });
        const stoppedThread = session.getThread(stoppedThreadId);
        const runningThread = session.getThread(runningThreadId);
        // the callstack for the stopped thread is obtainable but not available
        // the callstack for the running thread is not obtainable nor available
        assert.strictEqual(stoppedThread.name, stoppedThreadName);
        assert.strictEqual(stoppedThread.stopped, true);
        assert.strictEqual(session.getAllThreads().length, 2);
        assert.strictEqual(stoppedThread.getCallStack().length, 0);
        assert.strictEqual(stoppedThread.stoppedDetails.reason, stoppedReason);
        assert.strictEqual(runningThread.name, runningThreadName);
        assert.strictEqual(runningThread.stopped, false);
        assert.strictEqual(runningThread.getCallStack().length, 0);
        assert.strictEqual(runningThread.stoppedDetails, undefined);
        // after calling getCallStack, the callstack becomes available
        // and results in a request for the callstack in the debug adapter
        await stoppedThread.fetchCallStack();
        assert.notStrictEqual(stoppedThread.getCallStack().length, 0);
        assert.strictEqual(runningThread.getCallStack().length, 0);
        assert.strictEqual(sessionStub.callCount, 1);
        // calling getCallStack on the running thread returns empty array
        // and does not return in a request for the callstack in the debug
        // adapter
        await runningThread.fetchCallStack();
        assert.strictEqual(runningThread.getCallStack().length, 0);
        assert.strictEqual(sessionStub.callCount, 1);
        // clearing the callstack results in the callstack not being available
        stoppedThread.clearCallStack();
        assert.strictEqual(stoppedThread.stopped, true);
        assert.strictEqual(stoppedThread.getCallStack().length, 0);
        model.clearThreads(session.getId(), true);
        assert.strictEqual(session.getThread(stoppedThreadId), undefined);
        assert.strictEqual(session.getThread(runningThreadId), undefined);
        assert.strictEqual(session.getAllThreads().length, 0);
    });
    test('stack frame get specific source name', () => {
        const session = createTestSession(model);
        disposables.add(session);
        model.addSession(session);
        const { firstStackFrame, secondStackFrame } = createTwoStackFrames(session);
        assert.strictEqual(getSpecificSourceName(firstStackFrame), '.../b/c/d/internalModule.js');
        assert.strictEqual(getSpecificSourceName(secondStackFrame), '.../x/c/d/internalModule.js');
    });
    test('stack frame toString()', () => {
        const session = createTestSession(model);
        disposables.add(session);
        const thread = new Thread(session, 'mockthread', 1);
        const firstSource = new Source({
            name: 'internalModule.js',
            path: 'a/b/c/d/internalModule.js',
            sourceReference: 10,
        }, 'aDebugSessionId', mockUriIdentityService, new NullLogService());
        const stackFrame = new StackFrame(thread, 1, firstSource, 'app', 'normal', { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 }, 1, true);
        assert.strictEqual(stackFrame.toString(), 'app (internalModule.js:1)');
        const secondSource = new Source(undefined, 'aDebugSessionId', mockUriIdentityService, new NullLogService());
        const stackFrame2 = new StackFrame(thread, 2, secondSource, 'module', 'normal', { startLineNumber: undefined, startColumn: undefined, endLineNumber: undefined, endColumn: undefined }, 2, true);
        assert.strictEqual(stackFrame2.toString(), 'module');
    });
    test('debug child sessions are added in correct order', () => {
        const session = disposables.add(createTestSession(model));
        model.addSession(session);
        const secondSession = disposables.add(createTestSession(model, 'mockSession2'));
        model.addSession(secondSession);
        const firstChild = disposables.add(createTestSession(model, 'firstChild', { parentSession: session }));
        model.addSession(firstChild);
        const secondChild = disposables.add(createTestSession(model, 'secondChild', { parentSession: session }));
        model.addSession(secondChild);
        const thirdSession = disposables.add(createTestSession(model, 'mockSession3'));
        model.addSession(thirdSession);
        const anotherChild = disposables.add(createTestSession(model, 'secondChild', { parentSession: secondSession }));
        model.addSession(anotherChild);
        const sessions = model.getSessions();
        assert.strictEqual(sessions[0].getId(), session.getId());
        assert.strictEqual(sessions[1].getId(), firstChild.getId());
        assert.strictEqual(sessions[2].getId(), secondChild.getId());
        assert.strictEqual(sessions[3].getId(), secondSession.getId());
        assert.strictEqual(sessions[4].getId(), anotherChild.getId());
        assert.strictEqual(sessions[5].getId(), thirdSession.getId());
    });
    test('decorations', () => {
        const session = createTestSession(model);
        disposables.add(session);
        model.addSession(session);
        const { firstStackFrame, secondStackFrame } = createTwoStackFrames(session);
        let decorations = createDecorationsForStackFrame(firstStackFrame, true, false);
        assert.strictEqual(decorations.length, 3);
        assert.deepStrictEqual(decorations[0].range, new Range(1, 2, 1, 3));
        assert.strictEqual(decorations[0].options.glyphMarginClassName, ThemeIcon.asClassName(debugStackframe));
        assert.deepStrictEqual(decorations[1].range, new Range(1, 2, 1, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */));
        assert.strictEqual(decorations[1].options.className, 'debug-top-stack-frame-line');
        assert.strictEqual(decorations[1].options.isWholeLine, true);
        decorations = createDecorationsForStackFrame(secondStackFrame, true, false);
        assert.strictEqual(decorations.length, 2);
        assert.deepStrictEqual(decorations[0].range, new Range(1, 2, 1, 3));
        assert.strictEqual(decorations[0].options.glyphMarginClassName, ThemeIcon.asClassName(debugStackframeFocused));
        assert.deepStrictEqual(decorations[1].range, new Range(1, 2, 1, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */));
        assert.strictEqual(decorations[1].options.className, 'debug-focused-stack-frame-line');
        assert.strictEqual(decorations[1].options.isWholeLine, true);
        decorations = createDecorationsForStackFrame(firstStackFrame, true, false);
        assert.strictEqual(decorations.length, 3);
        assert.deepStrictEqual(decorations[0].range, new Range(1, 2, 1, 3));
        assert.strictEqual(decorations[0].options.glyphMarginClassName, ThemeIcon.asClassName(debugStackframe));
        assert.deepStrictEqual(decorations[1].range, new Range(1, 2, 1, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */));
        assert.strictEqual(decorations[1].options.className, 'debug-top-stack-frame-line');
        assert.strictEqual(decorations[1].options.isWholeLine, true);
        // Inline decoration gets rendered in this case
        assert.strictEqual(decorations[2].options.before?.inlineClassName, 'debug-top-stack-frame-column');
        assert.deepStrictEqual(decorations[2].range, new Range(1, 2, 1, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */));
    });
    test('contexts', () => {
        const session = createTestSession(model);
        disposables.add(session);
        model.addSession(session);
        const { firstStackFrame, secondStackFrame } = createTwoStackFrames(session);
        let context = getContext(firstStackFrame);
        assert.strictEqual(context?.sessionId, firstStackFrame.thread.session.getId());
        assert.strictEqual(context?.threadId, firstStackFrame.thread.getId());
        assert.strictEqual(context?.frameId, firstStackFrame.getId());
        context = getContext(secondStackFrame.thread);
        assert.strictEqual(context?.sessionId, secondStackFrame.thread.session.getId());
        assert.strictEqual(context?.threadId, secondStackFrame.thread.getId());
        assert.strictEqual(context?.frameId, undefined);
        context = getContext(session);
        assert.strictEqual(context?.sessionId, session.getId());
        assert.strictEqual(context?.threadId, undefined);
        assert.strictEqual(context?.frameId, undefined);
        let contributedContext = getContextForContributedActions(firstStackFrame);
        assert.strictEqual(contributedContext, firstStackFrame.source.raw.path);
        contributedContext = getContextForContributedActions(firstStackFrame.thread);
        assert.strictEqual(contributedContext, firstStackFrame.thread.threadId);
        contributedContext = getContextForContributedActions(session);
        assert.strictEqual(contributedContext, session.getId());
    });
    test('focusStackFrameThreadAndSession', () => {
        const threadId1 = 1;
        const threadName1 = 'firstThread';
        const threadId2 = 2;
        const threadName2 = 'secondThread';
        const stoppedReason = 'breakpoint';
        // Add the threads
        const session = new class extends DebugSession {
            get state() {
                return 2 /* State.Stopped */;
            }
        }(generateUuid(), { resolved: { name: 'stoppedSession', type: 'node', request: 'launch' }, unresolved: undefined }, undefined, model, undefined, undefined, undefined, undefined, undefined, undefined, mockWorkspaceContextService, undefined, undefined, undefined, mockUriIdentityService, new TestInstantiationService(), undefined, undefined, new NullLogService(), undefined, undefined, new TestAccessibilityService());
        disposables.add(session);
        const runningSession = createTestSession(model);
        disposables.add(runningSession);
        model.addSession(runningSession);
        model.addSession(session);
        session.raw = upcastPartial(mockRawSession);
        model.rawUpdate({
            sessionId: session.getId(),
            threads: [{
                    id: threadId1,
                    name: threadName1
                }]
        });
        // Stopped event with all threads stopped
        model.rawUpdate({
            sessionId: session.getId(),
            threads: [{
                    id: threadId1,
                    name: threadName1
                }, {
                    id: threadId2,
                    name: threadName2
                }],
            stoppedDetails: {
                reason: stoppedReason,
                threadId: 1,
                allThreadsStopped: true
            },
        });
        const thread = session.getThread(threadId1);
        const runningThread = session.getThread(threadId2);
        let toFocus = getStackFrameThreadAndSessionToFocus(model, undefined);
        // Verify stopped session and stopped thread get focused
        assert.deepStrictEqual(toFocus, { stackFrame: undefined, thread: thread, session: session });
        toFocus = getStackFrameThreadAndSessionToFocus(model, undefined, undefined, runningSession);
        assert.deepStrictEqual(toFocus, { stackFrame: undefined, thread: undefined, session: runningSession });
        toFocus = getStackFrameThreadAndSessionToFocus(model, undefined, thread);
        assert.deepStrictEqual(toFocus, { stackFrame: undefined, thread: thread, session: session });
        toFocus = getStackFrameThreadAndSessionToFocus(model, undefined, runningThread);
        assert.deepStrictEqual(toFocus, { stackFrame: undefined, thread: runningThread, session: session });
        const stackFrame = new StackFrame(thread, 5, undefined, 'stackframename2', undefined, undefined, 1, true);
        toFocus = getStackFrameThreadAndSessionToFocus(model, stackFrame);
        assert.deepStrictEqual(toFocus, { stackFrame: stackFrame, thread: thread, session: session });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbFN0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZGVidWcvdGVzdC9icm93c2VyL2NhbGxTdGFjay50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEtBQUssS0FBSyxNQUFNLE9BQU8sQ0FBQztBQUMvQixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFcEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMzRixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDbkUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRTNFLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxVQUFVLEVBQUUsK0JBQStCLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwSCxPQUFPLEVBQUUsZUFBZSxFQUFFLHNCQUFzQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdEYsT0FBTyxFQUFFLG9DQUFvQyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDckYsT0FBTyxFQUFFLFlB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