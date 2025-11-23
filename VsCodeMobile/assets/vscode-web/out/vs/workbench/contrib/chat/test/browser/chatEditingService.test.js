/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { waitForState } from '../../../../../base/common/observable.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { assertType } from '../../../../../base/common/types.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { assertThrowsAsync, ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EditOperation } from '../../../../../editor/common/core/editOperation.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IWorkbenchAssignmentService } from '../../../../services/assignment/common/assignmentService.js';
import { NullWorkbenchAssignmentService } from '../../../../services/assignment/test/common/nullAssignmentService.js';
import { nullExtensionDescription } from '../../../../services/extensions/common/extensions.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { TestWorkerService } from '../../../inlineChat/test/browser/testWorkerService.js';
import { IMcpService } from '../../../mcp/common/mcpTypes.js';
import { TestMcpService } from '../../../mcp/test/common/testMcpService.js';
import { IMultiDiffSourceResolverService } from '../../../multiDiffEditor/browser/multiDiffSourceResolverService.js';
import { INotebookService } from '../../../notebook/common/notebookService.js';
import { ChatEditingService } from '../../browser/chatEditing/chatEditingServiceImpl.js';
import { ChatSessionsService } from '../../browser/chatSessions.contribution.js';
import { ChatAgentService, IChatAgentService } from '../../common/chatAgents.js';
import { IChatEditingService } from '../../common/chatEditingService.js';
import { IChatService } from '../../common/chatService.js';
import { ChatService } from '../../common/chatServiceImpl.js';
import { IChatSessionsService } from '../../common/chatSessionsService.js';
import { IChatSlashCommandService } from '../../common/chatSlashCommands.js';
import { ChatTransferService, IChatTransferService } from '../../common/chatTransferService.js';
import { IChatVariablesService } from '../../common/chatVariables.js';
import { ChatAgentLocation, ChatModeKind } from '../../common/constants.js';
import { ILanguageModelsService } from '../../common/languageModels.js';
import { NullLanguageModelsService } from '../common/languageModels.js';
import { MockChatVariablesService } from '../common/mockChatVariables.js';
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
suite('ChatEditingService', function () {
    const store = new DisposableStore();
    let editingService;
    let chatService;
    let textModelService;
    setup(function () {
        const collection = new ServiceCollection();
        collection.set(IWorkbenchAssignmentService, new NullWorkbenchAssignmentService());
        collection.set(IChatAgentService, new SyncDescriptor(ChatAgentService));
        collection.set(IChatVariablesService, new MockChatVariablesService());
        collection.set(IChatSlashCommandService, new class extends mock() {
        });
        collection.set(IChatTransferService, new SyncDescriptor(ChatTransferService));
        collection.set(IChatSessionsService, new SyncDescriptor(ChatSessionsService));
        collection.set(IChatEditingService, new SyncDescriptor(ChatEditingService));
        collection.set(IEditorWorkerService, new SyncDescriptor(TestWorkerService));
        collection.set(IChatService, new SyncDescriptor(ChatService));
        collection.set(IMcpService, new TestMcpService());
        collection.set(ILanguageModelsService, new SyncDescriptor(NullLanguageModelsService));
        collection.set(IMultiDiffSourceResolverService, new class extends mock() {
            registerResolver(_resolver) {
                return Disposable.None;
            }
        });
        collection.set(INotebookService, new class extends mock() {
            getNotebookTextModel(_uri) {
                return undefined;
            }
            hasSupportedNotebooks(_resource) {
                return false;
            }
        });
        const insta = store.add(store.add(workbenchInstantiationService(undefined, store)).createChild(collection));
        store.add(insta.get(IEditorWorkerService));
        const value = insta.get(IChatEditingService);
        assert.ok(value instanceof ChatEditingService);
        editingService = value;
        chatService = insta.get(IChatService);
        store.add(insta.get(IChatSessionsService)); // Needs to be disposed in between test runs to clear extensionPoint contribution
        store.add(chatService);
        const chatAgentService = insta.get(IChatAgentService);
        const agent = {
            async invoke(request, progress, history, token) {
                return {};
            },
        };
        store.add(chatAgentService.registerAgent('testAgent', { ...getAgentData('testAgent'), isDefault: true }));
        store.add(chatAgentService.registerAgentImplementation('testAgent', agent));
        textModelService = insta.get(ITextModelService);
        const modelService = insta.get(IModelService);
        store.add(textModelService.registerTextModelContentProvider('test', {
            async provideTextContent(resource) {
                return store.add(modelService.createModel(resource.path.repeat(10), null, resource, false));
            },
        }));
    });
    teardown(async () => {
        store.clear();
        await chatService.waitForModelDisposals();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('create session', async function () {
        assert.ok(editingService);
        const modelRef = chatService.startSession(ChatAgentLocation.EditorInline, CancellationToken.None);
        const model = modelRef.object;
        const session = editingService.createEditingSession(model, true);
        assert.strictEqual(session.chatSessionResource.toString(), model.sessionResource.toString());
        assert.strictEqual(session.isGlobalEditingSession, true);
        await assertThrowsAsync(async () => {
            // DUPE not allowed
            editingService.createEditingSession(model);
        });
        session.dispose();
        modelRef.dispose();
    });
    test('create session, file entry & isCurrentlyBeingModifiedBy', async function () {
        assert.ok(editingService);
        const uri = URI.from({ scheme: 'test', path: 'HelloWorld' });
        const modelRef = chatService.startSession(ChatAgentLocation.Chat, CancellationToken.None);
        const model = modelRef.object;
        const session = model.editingSession;
        if (!session) {
            assert.fail('session not created');
        }
        const chatRequest = model?.addRequest({ text: '', parts: [] }, { variables: [] }, 0);
        assertType(chatRequest.response);
        chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [], done: false });
        chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [{ range: new Range(1, 1, 1, 1), text: 'FarBoo\n' }], done: false });
        chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [], done: true });
        const entry = await waitForState(session.entries.map(value => value.find(a => isEqual(a.modifiedURI, uri))));
        assert.ok(isEqual(entry.modifiedURI, uri));
        await waitForState(entry.isCurrentlyBeingModifiedBy.map(value => value === chatRequest.response));
        assert.ok(entry.isCurrentlyBeingModifiedBy.get()?.responseModel === chatRequest.response);
        const unset = waitForState(entry.isCurrentlyBeingModifiedBy.map(res => res === undefined));
        chatRequest.response.complete();
        await unset;
        await entry.reject();
        modelRef.dispose();
    });
    async function idleAfterEdit(session, model, uri, edits) {
        const isStreaming = waitForState(session.state.map(s => s === 1 /* ChatEditingSessionState.StreamingEdits */), Boolean);
        const chatRequest = model.addRequest({ text: '', parts: [] }, { variables: [] }, 0);
        assertType(chatRequest.response);
        chatRequest.response.updateContent({ kind: 'textEdit', uri, edits, done: true });
        const entry = await waitForState(session.entries.map(value => value.find(a => isEqual(a.modifiedURI, uri))));
        assert.ok(isEqual(entry.modifiedURI, uri));
        chatRequest.response.complete();
        await isStreaming;
        const isIdle = waitForState(session.state.map(s => s === 2 /* ChatEditingSessionState.Idle */), Boolean);
        await isIdle;
        return entry;
    }
    test('mirror typing outside -> accept', async function () {
        return runWithFakedTimers({}, async () => {
            assert.ok(editingService);
            const uri = URI.from({ scheme: 'test', path: 'abc\n' });
            const modelRef = store.add(chatService.startSession(ChatAgentLocation.Chat, CancellationToken.None));
            const model = modelRef.object;
            const session = model.editingSession;
            assertType(session, 'session not created');
            const entry = await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'FarBoo\n' }]);
            const original = store.add(await textModelService.createModelReference(entry.originalURI)).object.textEditorModel;
            const modified = store.add(await textModelService.createModelReference(entry.modifiedURI)).object.textEditorModel;
            assert.strictEqual(entry.state.get(), 0 /* ModifiedFileEntryState.Modified */);
            assert.strictEqual(original.getValue(), 'abc\n'.repeat(10));
            assert.strictEqual(modified.getValue(), 'FarBoo\n' + 'abc\n'.repeat(10));
            modified.pushEditOperations(null, [EditOperation.insert(new Position(3, 1), 'USER_TYPE\n')], () => null);
            assert.ok(modified.getValue().includes('USER_TYPE'));
            assert.ok(original.getValue().includes('USER_TYPE'));
            await entry.accept();
            assert.strictEqual(modified.getValue(), original.getValue());
            assert.strictEqual(entry.state.get(), 1 /* ModifiedFileEntryState.Accepted */);
            assert.ok(modified.getValue().includes('FarBoo'));
            assert.ok(original.getValue().includes('FarBoo'));
        });
    });
    test('mirror typing outside -> reject', async function () {
        return runWithFakedTimers({}, async () => {
            assert.ok(editingService);
            const uri = URI.from({ scheme: 'test', path: 'abc\n' });
            const modelRef = store.add(chatService.startSession(ChatAgentLocation.Chat, CancellationToken.None));
            const model = modelRef.object;
            const session = model.editingSession;
            assertType(session, 'session not created');
            const entry = await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'FarBoo\n' }]);
            const original = store.add(await textModelService.createModelReference(entry.originalURI)).object.textEditorModel;
            const modified = store.add(await textModelService.createModelReference(entry.modifiedURI)).object.textEditorModel;
            assert.strictEqual(entry.state.get(), 0 /* ModifiedFileEntryState.Modified */);
            assert.strictEqual(original.getValue(), 'abc\n'.repeat(10));
            assert.strictEqual(modified.getValue(), 'FarBoo\n' + 'abc\n'.repeat(10));
            modified.pushEditOperations(null, [EditOperation.insert(new Position(3, 1), 'USER_TYPE\n')], () => null);
            assert.ok(modified.getValue().includes('USER_TYPE'));
            assert.ok(original.getValue().includes('USER_TYPE'));
            await entry.reject();
            assert.strictEqual(modified.getValue(), original.getValue());
            assert.strictEqual(entry.state.get(), 2 /* ModifiedFileEntryState.Rejected */);
            assert.ok(!modified.getValue().includes('FarBoo'));
            assert.ok(!original.getValue().includes('FarBoo'));
        });
    });
    test('NO mirror typing inside -> accept', async function () {
        return runWithFakedTimers({}, async () => {
            assert.ok(editingService);
            const uri = URI.from({ scheme: 'test', path: 'abc\n' });
            const modelRef = store.add(chatService.startSession(ChatAgentLocation.Chat, CancellationToken.None));
            const model = modelRef.object;
            const session = model.editingSession;
            assertType(session, 'session not created');
            const entry = await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'FarBoo\n' }]);
            const original = store.add(await textModelService.createModelReference(entry.originalURI)).object.textEditorModel;
            const modified = store.add(await textModelService.createModelReference(entry.modifiedURI)).object.textEditorModel;
            assert.strictEqual(entry.state.get(), 0 /* ModifiedFileEntryState.Modified */);
            assert.strictEqual(original.getValue(), 'abc\n'.repeat(10));
            assert.strictEqual(modified.getValue(), 'FarBoo\n' + 'abc\n'.repeat(10));
            modified.pushEditOperations(null, [EditOperation.replace(new Range(1, 2, 1, 7), 'ooBar')], () => null);
            assert.ok(modified.getValue().includes('FooBar'));
            assert.ok(!original.getValue().includes('FooBar')); // typed in the AI edits, DO NOT transpose
            await entry.accept();
            assert.strictEqual(modified.getValue(), original.getValue());
            assert.strictEqual(entry.state.get(), 1 /* ModifiedFileEntryState.Accepted */);
            assert.ok(modified.getValue().includes('FooBar'));
            assert.ok(original.getValue().includes('FooBar'));
        });
    });
    test('ChatEditingService merges text edits it shouldn\'t merge, #272679', async function () {
        return runWithFakedTimers({}, async () => {
            assert.ok(editingService);
            const uri = URI.from({ scheme: 'test', path: 'abc' });
            const modified = store.add(await textModelService.createModelReference(uri)).object.textEditorModel;
            const modelRef = store.add(chatService.startSession(ChatAgentLocation.Chat, CancellationToken.None));
            const model = modelRef.object;
            const session = model.editingSession;
            assertType(session, 'session not created');
            modified.setValue('');
            await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'a' }, { range: new Range(1, 1, 1, 1), text: 'b' }]);
            assert.strictEqual(modified.getValue(), 'ab');
            modified.setValue('');
            await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'a' }]);
            await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'b' }]);
            assert.strictEqual(modified.getValue(), 'ba');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdTZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2Jyb3dzZXIvY2hhdEVkaXRpbmdTZXJ2aWNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLE1BQU0seUNBQXlDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDakUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM1RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN0SCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDbkYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUVuRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDL0UsT0FBTyxFQUFFLGlCQUFpQixF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