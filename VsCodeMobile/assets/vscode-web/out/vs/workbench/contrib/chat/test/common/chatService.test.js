/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { assertSnapshot } from '../../../../../base/test/common/snapshot.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IWorkbenchAssignmentService } from '../../../../services/assignment/common/assignmentService.js';
import { NullWorkbenchAssignmentService } from '../../../../services/assignment/test/common/nullAssignmentService.js';
import { IExtensionService, nullExtensionDescription } from '../../../../services/extensions/common/extensions.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { InMemoryTestFileService, mock, TestContextService, TestExtensionService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IMcpService } from '../../../mcp/common/mcpTypes.js';
import { TestMcpService } from '../../../mcp/test/common/testMcpService.js';
import { ChatAgentService, IChatAgentService } from '../../common/chatAgents.js';
import { IChatEditingService } from '../../common/chatEditingService.js';
import { IChatService } from '../../common/chatService.js';
import { ChatService } from '../../common/chatServiceImpl.js';
import { ChatSlashCommandService, IChatSlashCommandService } from '../../common/chatSlashCommands.js';
import { IChatVariablesService } from '../../common/chatVariables.js';
import { ChatAgentLocation, ChatModeKind } from '../../common/constants.js';
import { MockChatService } from './mockChatService.js';
import { MockChatVariablesService } from './mockChatVariables.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
const chatAgentWithUsedContextId = 'ChatProviderWithUsedContext';
const chatAgentWithUsedContext = {
    id: chatAgentWithUsedContextId,
    name: chatAgentWithUsedContextId,
    extensionId: nullExtensionDescription.identifier,
    extensionVersion: undefined,
    publisherDisplayName: '',
    extensionPublisherId: '',
    extensionDisplayName: '',
    locations: [ChatAgentLocation.Chat],
    modes: [ChatModeKind.Ask],
    metadata: {},
    slashCommands: [],
    disambiguation: [],
    async invoke(request, progress, history, token) {
        progress([{
                documents: [
                    {
                        uri: URI.file('/test/path/to/file'),
                        version: 3,
                        ranges: [
                            new Range(1, 1, 2, 2)
                        ]
                    }
                ],
                kind: 'usedContext'
            }]);
        return { metadata: { metadataKey: 'value' } };
    },
    async provideFollowups(sessionId, token) {
        return [{ kind: 'reply', message: 'Something else', agentId: '', tooltip: 'a tooltip' }];
    },
};
const chatAgentWithMarkdownId = 'ChatProviderWithMarkdown';
const chatAgentWithMarkdown = {
    id: chatAgentWithMarkdownId,
    name: chatAgentWithMarkdownId,
    extensionId: nullExtensionDescription.identifier,
    extensionVersion: undefined,
    publisherDisplayName: '',
    extensionPublisherId: '',
    extensionDisplayName: '',
    locations: [ChatAgentLocation.Chat],
    modes: [ChatModeKind.Ask],
    metadata: {},
    slashCommands: [],
    disambiguation: [],
    async invoke(request, progress, history, token) {
        progress([{ kind: 'markdownContent', content: new MarkdownString('test') }]);
        return { metadata: { metadataKey: 'value' } };
    },
    async provideFollowups(sessionId, token) {
        return [];
    },
};
function getAgentData(id) {
    return {
        name: id,
        id: id,
        extensionId: nullExtensionDescription.identifier,
        extensionVersion: undefined,
        extensionPublisherId: '',
        publisherDisplayName: '',
        extensionDisplayName: '',
        locations: [ChatAgentLocation.Chat],
        modes: [ChatModeKind.Ask],
        metadata: {},
        slashCommands: [],
        disambiguation: [],
    };
}
suite('ChatService', () => {
    const testDisposables = new DisposableStore();
    let instantiationService;
    let testFileService;
    let chatAgentService;
    const testServices = [];
    /**
     * Ensure we wait for model disposals from all created ChatServices
     */
    function createChatService() {
        const service = testDisposables.add(instantiationService.createInstance(ChatService));
        testServices.push(service);
        return service;
    }
    function startSessionModel(service, location = ChatAgentLocation.Chat) {
        const ref = testDisposables.add(service.startSession(location, CancellationToken.None));
        return ref;
    }
    async function getOrRestoreModel(service, resource) {
        const ref = await service.getOrRestoreSession(resource);
        if (!ref) {
            return undefined;
        }
        return testDisposables.add(ref).object;
    }
    setup(async () => {
        instantiationService = testDisposables.add(new TestInstantiationService(new ServiceCollection([IChatVariablesService, new MockChatVariablesService()], [IWorkbenchAssignmentService, new NullWorkbenchAssignmentService()], [IMcpService, new TestMcpService()])));
        instantiationService.stub(IStorageService, testDisposables.add(new TestStorageService()));
        instantiationService.stub(ILogService, new NullLogService());
        instantiationService.stub(ITelemetryService, NullTelemetryService);
        instantiationService.stub(IExtensionService, new TestExtensionService());
        instantiationService.stub(IContextKeyService, new MockContextKeyService());
        instantiationService.stub(IViewsService, new TestExtensionService());
        instantiationService.stub(IWorkspaceContextService, new TestContextService());
        instantiationService.stub(IChatSlashCommandService, testDisposables.add(instantiationService.createInstance(ChatSlashCommandService)));
        instantiationService.stub(IConfigurationService, new TestConfigurationService());
        instantiationService.stub(IChatService, new MockChatService());
        instantiationService.stub(IEnvironmentService, { workspaceStorageHome: URI.file('/test/path/to/workspaceStorage') });
        instantiationService.stub(ILifecycleService, { onWillShutdown: Event.None });
        instantiationService.stub(IChatEditingService, new class extends mock() {
            startOrContinueGlobalEditingSession() {
                return {
                    requestDisablement: observableValue('requestDisablement', []),
                    dispose: () => { }
                };
            }
        });
        // Configure test file service with tracking and in-memory storage
        testFileService = testDisposables.add(new InMemoryTestFileService());
        instantiationService.stub(IFileService, testFileService);
        chatAgentService = testDisposables.add(instantiationService.createInstance(ChatAgentService));
        instantiationService.stub(IChatAgentService, chatAgentService);
        const agent = {
            async invoke(request, progress, history, token) {
                return {};
            },
        };
        testDisposables.add(chatAgentService.registerAgent('testAgent', { ...getAgentData('testAgent'), isDefault: true }));
        testDisposables.add(chatAgentService.registerAgent(chatAgentWithUsedContextId, getAgentData(chatAgentWithUsedContextId)));
        testDisposables.add(chatAgentService.registerAgent(chatAgentWithMarkdownId, getAgentData(chatAgentWithMarkdownId)));
        testDisposables.add(chatAgentService.registerAgentImplementation('testAgent', agent));
        chatAgentService.updateAgent('testAgent', {});
    });
    teardown(async () => {
        testDisposables.clear();
        await Promise.all(testServices.map(s => s.waitForModelDisposals()));
        testServices.length = 0;
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('retrieveSession', async () => {
        const testService = createChatService();
        // Don't add refs to testDisposables so we can control disposal
        const session1Ref = testService.startSession(ChatAgentLocation.Chat, CancellationToken.None);
        const session1 = session1Ref.object;
        session1.addRequest({ parts: [], text: 'request 1' }, { variables: [] }, 0);
        const session2Ref = testService.startSession(ChatAgentLocation.Chat, CancellationToken.None);
        const session2 = session2Ref.object;
        session2.addRequest({ parts: [], text: 'request 2' }, { variables: [] }, 0);
        // Dispose refs to trigger persistence to file service
        session1Ref.dispose();
        session2Ref.dispose();
        // Wait for async persistence to complete
        await testService.waitForModelDisposals();
        // Verify that sessions were written to the file service
        assert.strictEqual(testFileService.writeOperations.length, 2, 'Should have written 2 sessions to file service');
        const session1WriteOp = testFileService.writeOperations.find((op) => op.content.includes('request 1'));
        const session2WriteOp = testFileService.writeOperations.find((op) => op.content.includes('request 2'));
        assert.ok(session1WriteOp, 'Session 1 should have been written to file service');
        assert.ok(session2WriteOp, 'Session 2 should have been written to file service');
        // Create a new service instance to simulate app restart
        const testService2 = createChatService();
        // Retrieve sessions and verify they're loaded from file service
        const retrieved1 = await getOrRestoreModel(testService2, session1.sessionResource);
        const retrieved2 = await getOrRestoreModel(testService2, session2.sessionResource);
        assert.ok(retrieved1, 'Should retrieve session 1');
        assert.ok(retrieved2, 'Should retrieve session 2');
        assert.deepStrictEqual(retrieved1.getRequests()[0]?.message.text, 'request 1');
        assert.deepStrictEqual(retrieved2.getRequests()[0]?.message.text, 'request 2');
    });
    test('addCompleteRequest', async () => {
        const testService = createChatService();
        const modelRef = testDisposables.add(startSessionModel(testService));
        const model = modelRef.object;
        assert.strictEqual(model.getRequests().length, 0);
        await testService.addCompleteRequest(model.sessionResource, 'test request', undefined, 0, { message: 'test response' });
        assert.strictEqual(model.getRequests().length, 1);
        assert.ok(model.getRequests()[0].response);
        assert.strictEqual(model.getRequests()[0].response?.response.toString(), 'test response');
    });
    test('sendRequest fails', async () => {
        const testService = createChatService();
        const modelRef = testDisposables.add(startSessionModel(testService));
        const model = modelRef.object;
        const response = await testService.sendRequest(model.sessionResource, `@${chatAgentWithUsedContextId} test request`);
        assert(response);
        await response.responseCompletePromise;
        await assertSnapshot(toSnapshotExportData(model));
    });
    test('history', async () => {
        const historyLengthAgent = {
            async invoke(request, progress, history, token) {
                return {
                    metadata: { historyLength: history.length }
                };
            },
        };
        testDisposables.add(chatAgentService.registerAgent('defaultAgent', { ...getAgentData('defaultAgent'), isDefault: true }));
        testDisposables.add(chatAgentService.registerAgent('agent2', getAgentData('agent2')));
        testDisposables.add(chatAgentService.registerAgentImplementation('defaultAgent', historyLengthAgent));
        testDisposables.add(chatAgentService.registerAgentImplementation('agent2', historyLengthAgent));
        const testService = createChatService();
        const modelRef = testDisposables.add(startSessionModel(testService));
        const model = modelRef.object;
        // Send a request to default agent
        const response = await testService.sendRequest(model.sessionResource, `test request`, { agentId: 'defaultAgent' });
        assert(response);
        await response.responseCompletePromise;
        assert.strictEqual(model.getRequests().length, 1);
        assert.strictEqual(model.getRequests()[0].response?.result?.metadata?.historyLength, 0);
        // Send a request to agent2- it can't see the default agent's message
        const response2 = await testService.sendRequest(model.sessionResource, `test request`, { agentId: 'agent2' });
        assert(response2);
        await response2.responseCompletePromise;
        assert.strictEqual(model.getRequests().length, 2);
        assert.strictEqual(model.getRequests()[1].response?.result?.metadata?.historyLength, 0);
        // Send a request to defaultAgent - the default agent can see agent2's message
        const response3 = await testService.sendRequest(model.sessionResource, `test request`, { agentId: 'defaultAgent' });
        assert(response3);
        await response3.responseCompletePromise;
        assert.strictEqual(model.getRequests().length, 3);
        assert.strictEqual(model.getRequests()[2].response?.result?.metadata?.historyLength, 2);
    });
    test('can serialize', async () => {
        testDisposables.add(chatAgentService.registerAgentImplementation(chatAgentWithUsedContextId, chatAgentWithUsedContext));
        chatAgentService.updateAgent(chatAgentWithUsedContextId, {});
        const testService = createChatService();
        const modelRef = testDisposables.add(startSessionModel(testService));
        const model = modelRef.object;
        assert.strictEqual(model.getRequests().length, 0);
        await assertSnapshot(toSnapshotExportData(model));
        const response = await testService.sendRequest(model.sessionResource, `@${chatAgentWithUsedContextId} test request`);
        assert(response);
        await response.responseCompletePromise;
        assert.strictEqual(model.getRequests().length, 1);
        const response2 = await testService.sendRequest(model.sessionResource, `test request 2`);
        assert(response2);
        await response2.responseCompletePromise;
        assert.strictEqual(model.getRequests().length, 2);
        await assertSnapshot(toSnapshotExportData(model));
    });
    test('can deserialize', async () => {
        let serializedChatData;
        testDisposables.add(chatAgentService.registerAgentImplementation(chatAgentWithUsedContextId, chatAgentWithUsedContext));
        // create the first service, send request, get response, and serialize the state
        { // serapate block to not leak variables in outer scope
            const testService = createChatService();
            const chatModel1Ref = testDisposables.add(startSessionModel(testService));
            const chatModel1 = chatModel1Ref.object;
            assert.strictEqual(chatModel1.getRequests().length, 0);
            const response = await testService.sendRequest(chatModel1.sessionResource, `@${chatAgentWithUsedContextId} test request`);
            assert(response);
            await response.responseCompletePromise;
            serializedChatData = JSON.parse(JSON.stringify(chatModel1));
        }
        // try deserializing the state into a new service
        const testService2 = createChatService();
        const chatModel2Ref = testService2.loadSessionFromContent(serializedChatData);
        assert(chatModel2Ref);
        testDisposables.add(chatModel2Ref);
        const chatModel2 = chatModel2Ref.object;
        await assertSnapshot(toSnapshotExportData(chatModel2));
    });
    test('can deserialize with response', async () => {
        let serializedChatData;
        testDisposables.add(chatAgentService.registerAgentImplementation(chatAgentWithMarkdownId, chatAgentWithMarkdown));
        {
            const testService = createChatService();
            const chatModel1Ref = testDisposables.add(startSessionModel(testService));
            const chatModel1 = chatModel1Ref.object;
            assert.strictEqual(chatModel1.getRequests().length, 0);
            const response = await testService.sendRequest(chatModel1.sessionResource, `@${chatAgentWithUsedContextId} test request`);
            assert(response);
            await response.responseCompletePromise;
            serializedChatData = JSON.parse(JSON.stringify(chatModel1));
        }
        // try deserializing the state into a new service
        const testService2 = createChatService();
        const chatModel2Ref = testService2.loadSessionFromContent(serializedChatData);
        assert(chatModel2Ref);
        testDisposables.add(chatModel2Ref);
        const chatModel2 = chatModel2Ref.object;
        await assertSnapshot(toSnapshotExportData(chatModel2));
    });
});
function toSnapshotExportData(model) {
    const exp = model.toExport();
    return {
        ...exp,
        requests: exp.requests.map(r => {
            return {
                ...r,
                modelState: {
                    ...r.modelState,
                    completedAt: undefined
                },
                timestamp: undefined,
                requestId: undefined, // id contains a random part
                responseId: undefined, // id contains a random part
            };
        })
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlcnZpY2UudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL2NoYXRTZXJ2aWNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDN0UsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBQ3pILE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUN0RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN6SCxPQUFP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