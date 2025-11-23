/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import * as sinon from 'sinon';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../platform/configuration/test/common/testConfigurationService.js';
import { ContextKeyService } from '../../../../platform/contextkey/browser/contextKeyService.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../platform/log/common/log.js';
import { ChatSessionsService } from '../../../contrib/chat/browser/chatSessions.contribution.js';
import { IChatSessionsService } from '../../../contrib/chat/common/chatSessionsService.js';
import { LocalChatSessionUri } from '../../../contrib/chat/common/chatUri.js';
import { ChatAgentLocation } from '../../../contrib/chat/common/constants.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { mock, TestExtensionService } from '../../../test/common/workbenchTestServices.js';
import { MainThreadChatSessions, ObservableChatSession } from '../../browser/mainThreadChatSessions.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { isEqual } from '../../../../base/common/resources.js';
suite('ObservableChatSession', function () {
    let disposables;
    let logService;
    let dialogService;
    let proxy;
    setup(function () {
        disposables = new DisposableStore();
        logService = new NullLogService();
        dialogService = new class extends mock() {
            async confirm() {
                return { confirmed: true };
            }
        };
        proxy = {
            $provideChatSessionContent: sinon.stub(),
            $provideChatSessionProviderOptions: sinon.stub().resolves(undefined),
            $provideHandleOptionsChange: sinon.stub(),
            $interruptChatSessionActiveResponse: sinon.stub(),
            $invokeChatSessionRequestHandler: sinon.stub(),
            $disposeChatSessionContent: sinon.stub(),
            $provideChatSessionItems: sinon.stub(),
            $provideNewChatSessionItem: sinon.stub().resolves({ label: 'New Session' })
        };
    });
    teardown(function () {
        disposables.dispose();
        sinon.restore();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    function createSessionContent(options = {}) {
        return {
            id: options.id || 'test-id',
            history: options.history || [],
            hasActiveResponseCallback: options.hasActiveResponseCallback || false,
            hasRequestHandler: options.hasRequestHandler || false
        };
    }
    async function createInitializedSession(sessionContent, sessionId = 'test-id') {
        const resource = LocalChatSessionUri.forSession(sessionId);
        const session = new ObservableChatSession(resource, 1, proxy, logService, dialogService);
        proxy.$provideChatSessionContent.resolves(sessionContent);
        await session.initialize(CancellationToken.None);
        return session;
    }
    test('constructor creates session with proper initial state', function () {
        const sessionId = 'test-id';
        const resource = LocalChatSessionUri.forSession(sessionId);
        const session = disposables.add(new ObservableChatSession(resource, 1, proxy, logService, dialogService));
        assert.strictEqual(session.providerHandle, 1);
        assert.deepStrictEqual(session.history, []);
        assert.ok(session.progressObs);
        assert.ok(session.isCompleteObs);
        // Initial state should be inactive and incomplete
        assert.deepStrictEqual(session.progressObs.get(), []);
        assert.strictEqual(session.isCompleteObs.get(), false);
    });
    test('session queues progress before initialization and processes it after', async function () {
        const sessionId = 'test-id';
        const resource = LocalChatSessionUri.forSession(sessionId);
        const session = disposables.add(new ObservableChatSession(resource, 1, proxy, logService, dialogService));
        const progress1 = { kind: 'progressMessage', content: { value: 'Hello', isTrusted: false } };
        const progress2 = { kind: 'progressMessage', content: { value: 'World', isTrusted: false } };
        // Add progress before initialization - should be queued
        session.handleProgressChunk('req1', [progress1]);
        session.handleProgressChunk('req1', [progress2]);
        // Progress should be queued, not visible yet
        assert.deepStrictEqual(session.progressObs.get(), []);
        // Initialize the session
        const sessionContent = createSessionContent();
        proxy.$provideChatSessionContent.resolves(sessionContent);
        await session.initialize(CancellationToken.None);
        // Now progress should be visible
        assert.strictEqual(session.progressObs.get().length, 2);
        assert.deepStrictEqual(session.progressObs.get(), [progress1, progress2]);
        assert.strictEqual(session.isCompleteObs.get(), true); // Should be complete for sessions without active response callback or request handler
    });
    test('initialization loads session history and sets up capabilities', async function () {
        const sessionHistory = [
            { type: 'request', prompt: 'Previous question' },
            { type: 'response', parts: [{ kind: 'progressMessage', content: { value: 'Previous answer', isTrusted: false } }] }
        ];
        const sessionContent = createSessionContent({
            history: sessionHistory,
            hasActiveResponseCallback: true,
            hasRequestHandler: true
        });
        const session = disposables.add(await createInitializedSession(sessionContent));
        // Verify history was loaded
        assert.strictEqual(session.history.length, 2);
        assert.strictEqual(session.history[0].type, 'request');
        assert.strictEqual(session.history[0].prompt, 'Previous question');
        assert.strictEqual(session.history[1].type, 'response');
        // Verify capabilities were set up
        assert.ok(session.interruptActiveResponseCallback);
        assert.ok(session.requestHandler);
    });
    test('initialization is idempotent and returns same promise', async function () {
        const sessionId = 'test-id';
        const resource = LocalChatSessionUri.forSession(sessionId);
        const session = disposables.add(new ObservableChatSession(resource, 1, proxy, logService, dialogService));
        const sessionContent = createSessionContent();
        proxy.$provideChatSessionContent.resolves(sessionContent);
        const promise1 = session.initialize(CancellationToken.None);
        const promise2 = session.initialize(CancellationToken.None);
        assert.strictEqual(promise1, promise2);
        await promise1;
        // Should only call proxy once even though initialize was called twice
        assert.ok(proxy.$provideChatSessionContent.calledOnce);
    });
    test('progress handling works correctly after initialization', async function () {
        const sessionContent = createSessionContent();
        const session = disposables.add(await createInitializedSession(sessionContent));
        const progress = { kind: 'progressMessage', content: { value: 'New progress', isTrusted: false } };
        // Add progress after initialization
        session.handleProgressChunk('req1', [progress]);
        assert.deepStrictEqual(session.progressObs.get(), [progress]);
        // Session with no capabilities should remain complete
        assert.strictEqual(session.isCompleteObs.get(), true);
    });
    test('progress completion updates session state correctly', async function () {
        const sessionContent = createSessionContent();
        const session = disposables.add(await createInitializedSession(sessionContent));
        // Add some progress first
        const progress = { kind: 'progressMessage', content: { value: 'Processing...', isTrusted: false } };
        session.handleProgressChunk('req1', [progress]);
        // Session with no capabilities should already be complete
        assert.strictEqual(session.isCompleteObs.get(), true);
        session.handleProgressComplete('req1');
        assert.strictEqual(session.isCompleteObs.get(), true);
    });
    test('session with active response callback becomes active when progress is added', async function () {
        const sessionContent = createSessionContent({ hasActiveResponseCallback: true });
        const session = disposables.add(await createInitializedSession(sessionContent));
        // Session should start inactive and incomplete (has capabilities but no active progress)
        assert.strictEqual(session.isCompleteObs.get(), false);
        const progress = { kind: 'progressMessage', content: { value: 'Processing...', isTrusted: false } };
        session.handleProgressChunk('req1', [progress]);
        assert.strictEqual(session.isCompleteObs.get(), false);
        session.handleProgressComplete('req1');
        assert.strictEqual(session.isCompleteObs.get(), true);
    });
    test('request handler forwards requests to proxy', async function () {
        const sessionContent = createSessionContent({ hasRequestHandler: true });
        const session = disposables.add(await createInitializedSession(sessionContent));
        assert.ok(session.requestHandler);
        const request = {
            requestId: 'req1',
            sessionId: 'test-session',
            sessionResource: LocalChatSessionUri.forSession('test-session'),
            agentId: 'test-agent',
            message: 'Test prompt',
            location: ChatAgentLocation.Chat,
            variables: { variables: [] }
        };
        const progressCallback = sinon.stub();
        await session.requestHandler(request, progressCallback, [], CancellationToken.None);
        assert.ok(proxy.$invokeChatSessionRequestHandler.calledOnceWith(1, session.sessionResource, request, [], CancellationToken.None));
    });
    test('request handler forwards progress updates to external callback', async function () {
        const sessionContent = createSessionContent({ hasRequestHandler: true });
        const session = disposables.add(await createInitializedSession(sessionContent));
        assert.ok(session.requestHandler);
        const request = {
            requestId: 'req1',
            sessionId: 'test-session',
            sessionResource: LocalChatSessionUri.forSession('test-session'),
            agentId: 'test-agent',
            message: 'Test prompt',
            location: ChatAgentLocation.Chat,
            variables: { variables: [] }
        };
        const progressCallback = sinon.stub();
        let resolveRequest;
        const requestPromise = new Promise(resolve => {
            resolveRequest = resolve;
        });
        proxy.$invokeChatSessionRequestHandler.returns(requestPromise);
        const requestHandlerPromise = session.requestHandler(request, progressCallback, [], CancellationToken.None);
        const progress1 = { kind: 'progressMessage', content: { value: 'Progress 1', isTrusted: false } };
        const progress2 = { kind: 'progressMessage', content: { value: 'Progress 2', isTrusted: false } };
        session.handleProgressChunk('req1', [progress1]);
        session.handleProgressChunk('req1', [progress2]);
        // Wait a bit for autorun to trigger
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.ok(progressCallback.calledTwice);
        assert.deepStrictEqual(progressCallback.firstCall.args[0], [progress1]);
        assert.deepStrictEqual(progressCallback.secondCall.args[0], [progress2]);
        // Complete the request
        resolveRequest();
        await requestHandlerPromise;
        assert.strictEqual(session.isCompleteObs.get(), true);
    });
    test('dispose properly cleans up resources and notifies listeners', function () {
        const sessionId = 'test-id';
        const resource = LocalChatSessionUri.forSession(sessionId);
        const session = disposables.add(new ObservableChatSession(resource, 1, proxy, logService, dialogService));
        let disposeEventFired = false;
        const disposable = session.onWillDispose(() => {
            disposeEventFired = true;
        });
        session.dispose();
        assert.ok(disposeEventFired);
        assert.ok(proxy.$disposeChatSessionContent.calledOnceWith(1, resource));
        disposable.dispose();
    });
    test('session with multiple request/response pairs in history', async function () {
        const sessionHistory = [
            { type: 'request', prompt: 'First question' },
            { type: 'response', parts: [{ kind: 'progressMessage', content: { value: 'First answer', isTrusted: false } }] },
            { type: 'request', prompt: 'Second question' },
            { type: 'response', parts: [{ kind: 'progressMessage', content: { value: 'Second answer', isTrusted: false } }] }
        ];
        const sessionContent = createSessionContent({
            history: sessionHistory,
            hasActiveResponseCallback: false,
            hasRequestHandler: false
        });
        const session = disposables.add(await createInitializedSession(sessionContent));
        // Verify all history was loaded correctly
        assert.strictEqual(session.history.length, 4);
        assert.strictEqual(session.history[0].type, 'request');
        assert.strictEqual(session.history[0].prompt, 'First question');
        assert.strictEqual(session.history[1].type, 'response');
        assert.strictEqual(session.history[1].parts[0].content.value, 'First answer');
        assert.strictEqual(session.history[2].type, 'request');
        assert.strictEqual(session.history[2].prompt, 'Second question');
        assert.strictEqual(session.history[3].type, 'response');
        assert.strictEqual(session.history[3].parts[0].content.value, 'Second answer');
        // Session should be complete since it has no capabilities
        assert.strictEqual(session.isCompleteObs.get(), true);
    });
});
suite('MainThreadChatSessions', function () {
    let instantiationService;
    let mainThread;
    let proxy;
    let chatSessionsService;
    let disposables;
    const exampleSessionResource = LocalChatSessionUri.forSession('new-session-id');
    setup(function () {
        disposables = new DisposableStore();
        instantiationService = new TestInstantiationService();
        proxy = {
            $provideChatSessionContent: sinon.stub(),
            $provideChatSessionProviderOptions: sinon.stub().resolves(undefined),
            $provideHandleOptionsChange: sinon.stub(),
            $interruptChatSessionActiveResponse: sinon.stub(),
            $invokeChatSessionRequestHandler: sinon.stub(),
            $disposeChatSessionContent: sinon.stub(),
            $provideChatSessionItems: sinon.stub(),
            $provideNewChatSessionItem: sinon.stub().resolves({ resource: exampleSessionResource, label: 'New Session' })
        };
        const extHostContext = new class {
            constructor() {
                this.remoteAuthority = '';
                this.extensionHostKind = 1 /* ExtensionHostKind.LocalProcess */;
            }
            dispose() { }
            assertRegistered() { }
            set(v) { return null; }
            getProxy() { return proxy; }
            drain() { return null; }
        };
        instantiationService.stub(IConfigurationService, new TestConfigurationService());
        instantiationService.stub(IContextKeyService, disposables.add(instantiationService.createInstance(ContextKeyService)));
        instantiationService.stub(ILogService, new NullLogService());
        instantiationService.stub(IEditorService, new class extends mock() {
        });
        instantiationService.stub(IExtensionService, new TestExtensionService());
        instantiationService.stub(IViewsService, new class extends mock() {
            async openView() { return null; }
        });
        instantiationService.stub(IDialogService, new class extends mock() {
            async confirm() {
                return { confirmed: true };
            }
        });
        instantiationService.stub(ILabelService, new class extends mock() {
            registerFormatter() {
                return {
                    dispose: () => { }
                };
            }
        });
        chatSessionsService = disposables.add(instantiationService.createInstance(ChatSessionsService));
        instantiationService.stub(IChatSessionsService, chatSessionsService);
        mainThread = disposables.add(instantiationService.createInstance(MainThreadChatSessions, extHostContext));
    });
    teardown(function () {
        disposables.dispose();
        instantiationService.dispose();
        sinon.restore();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('provideNewChatSessionItem creates a new chat session', async function () {
        mainThread.$registerChatSessionItemProvider(1, 'test-type');
        // Create a mock IChatAgentRequest
        const mockRequest = {
            sessionId: 'test-session',
            sessionResource: LocalChatSessionUri.forSession('test-session'),
            requestId: 'test-request',
            agentId: 'test-agent',
            message: 'my prompt',
            location: ChatAgentLocation.Chat,
            variables: { variables: [] }
        };
        // Valid
        const chatSessionItem = await chatSessionsService.getNewChatSessionItem('test-type', {
            request: mockRequest,
            metadata: {}
        }, CancellationToken.None);
        assert.ok(isEqual(chatSessionItem.resource, exampleSessionResource));
        assert.strictEqual(chatSessionItem.label, 'New Session');
        // Invalid session type should throw
        await assert.rejects(chatSessionsService.getNewChatSessionItem('invalid-type', {
            request: mockRequest,
            metadata: {}
        }, CancellationToken.None));
        mainThread.$unregisterChatSessionItemProvider(1);
    });
    test('provideChatSessionContent creates and initializes session', async function () {
        const sessionScheme = 'test-session-type';
        mainThread.$registerChatSessionContentProvider(1, sessionScheme);
        const sessionContent = {
            id: 'test-session',
            history: [],
            hasActiveResponseCallback: false,
            hasRequestHandler: false
        };
        const resource = URI.parse(`${sessionScheme}:/test-session`);
        proxy.$provideChatSessionContent.resolves(sessionContent);
        const session1 = await chatSessionsService.getOrCreateChatSession(resource, CancellationToken.None);
        assert.ok(session1);
        const session2 = await chatSessionsService.getOrCreateChatSession(resource, CancellationToken.None);
        assert.strictEqual(session1, session2);
        assert.ok(proxy.$provideChatSessionContent.calledOnce);
        mainThread.$unregisterChatSessionContentProvider(1);
    });
    test('$handleProgressChunk routes to correct session', async function () {
        const sessionScheme = 'test-session-type';
        mainThread.$registerChatSessionContentProvider(1, sessionScheme);
        const sessionContent = {
            id: 'test-session',
            history: [],
            hasActiveResponseCallback: false,
            hasRequestHandler: false
        };
        proxy.$provideChatSessionContent.resolves(sessionContent);
        const resource = URI.parse(`${sessionScheme}:/test-session`);
        const session = await chatSessionsService.getOrCreateChatSession(resource, CancellationToken.None);
        const progressDto = { kind: 'progressMessage', content: { value: 'Test', isTrusted: false } };
        await mainThread.$handleProgressChunk(1, resource, 'req1', [progressDto]);
        assert.strictEqual(session.progressObs.get().length, 1);
        assert.strictEqual(session.progressObs.get()[0].kind, 'progressMessage');
        mainThread.$unregisterChatSessionContentProvider(1);
    });
    test('$handleProgressComplete marks session complete', async function () {
        const sessionScheme = 'test-session-type';
        mainThread.$registerChatSessionContentProvider(1, sessionScheme);
        const sessionContent = {
            id: 'test-session',
            history: [],
            hasActiveResponseCallback: false,
            hasRequestHandler: false
        };
        proxy.$provideChatSessionContent.resolves(sessionContent);
        const resource = URI.parse(`${sessionScheme}:/test-session`);
        const session = await chatSessionsService.getOrCreateChatSession(resource, CancellationToken.None);
        const progressDto = { kind: 'progressMessage', content: { value: 'Test', isTrusted: false } };
        await mainThread.$handleProgressChunk(1, resource, 'req1', [progressDto]);
        mainThread.$handleProgressComplete(1, resource, 'req1');
        assert.strictEqual(session.isCompleteObs.get(), true);
        mainThread.$unregisterChatSessionContentProvider(1);
    });
    test('integration with multiple request/response pairs', async function () {
        const sessionScheme = 'test-session-type';
        mainThread.$registerChatSessionContentProvider(1, sessionScheme);
        const sessionContent = {
            id: 'multi-turn-session',
            history: [
                { type: 'request', prompt: 'First question' },
                { type: 'response', parts: [{ kind: 'progressMessage', content: { value: 'First answer', isTrusted: false } }] },
                { type: 'request', prompt: 'Second question' },
                { type: 'response', parts: [{ kind: 'progressMessage', content: { value: 'Second answer', isTrusted: false } }] }
            ],
            hasActiveResponseCallback: false,
            hasRequestHandler: false
        };
        proxy.$provideChatSessionContent.resolves(sessionContent);
        const resource = URI.parse(`${sessionScheme}:/multi-turn-session`);
        const session = await chatSessionsService.getOrCreateChatSession(resource, CancellationToken.None);
        // Verify the session loaded correctly
        assert.ok(session);
        assert.strictEqual(session.history.length, 4);
        // Verify all history items are correctly loaded
        assert.strictEqual(session.history[0].type, 'request');
        assert.strictEqual(session.history[0].prompt, 'First question');
        assert.strictEqual(session.history[1].type, 'response');
        assert.strictEqual(session.history[2].type, 'request');
        assert.strictEqual(session.history[2].prompt, 'Second question');
        assert.strictEqual(session.history[3].type, 'response');
        // Session should be complete since it has no active capabilities
        assert.strictEqual(session.isCompleteObs.get(), true);
        mainThread.$unregisterChatSessionContentProvider(1);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZENoYXRTZXNzaW9ucy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvdGVzdC9icm93c2VyL21haW5UaHJlYWRDaGF0U2Vzc2lvbnMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFDL0IsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw0RUFBNEUsQ0FBQztBQUN0SCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sNEVBQTRFLENBQUM7QUFDdEgsT0FBTyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUdqRyxPQUFPLEVBQW9CLG9CQUFvQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDN0csT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0s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