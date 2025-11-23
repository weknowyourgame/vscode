/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { assertType } from '../../../../../base/common/types.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { assertSnapshot } from '../../../../../base/test/common/snapshot.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDiffProviderFactoryService } from '../../../../../editor/browser/widget/diffEditor/diffProviderFactoryService.js';
import { EditOperation } from '../../../../../editor/common/core/editOperation.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { TestDiffProviderFactoryService } from '../../../../../editor/test/browser/diff/testDiffProviderFactoryService.js';
import { TestCommandService } from '../../../../../editor/test/browser/editorTestServices.js';
import { instantiateTestCodeEditor } from '../../../../../editor/test/browser/testCodeEditor.js';
import { IAccessibleViewService } from '../../../../../platform/accessibility/browser/accessibleView.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IEditorProgressService } from '../../../../../platform/progress/common/progress.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IWorkbenchAssignmentService } from '../../../../services/assignment/common/assignmentService.js';
import { NullWorkbenchAssignmentService } from '../../../../services/assignment/test/common/nullAssignmentService.js';
import { IExtensionService, nullExtensionDescription } from '../../../../services/extensions/common/extensions.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { TestContextService, TestExtensionService } from '../../../../test/common/workbenchTestServices.js';
import { IChatAccessibilityService, IChatWidgetService, IQuickChatService } from '../../../chat/browser/chat.js';
import { ChatSessionsService } from '../../../chat/browser/chatSessions.contribution.js';
import { ChatVariablesService } from '../../../chat/browser/chatVariables.js';
import { ChatAgentService, IChatAgentService } from '../../../chat/common/chatAgents.js';
import { IChatEditingService } from '../../../chat/common/chatEditingService.js';
import { IChatService } from '../../../chat/common/chatService.js';
import { ChatService } from '../../../chat/common/chatServiceImpl.js';
import { IChatSessionsService } from '../../../chat/common/chatSessionsService.js';
import { ChatSlashCommandService, IChatSlashCommandService } from '../../../chat/common/chatSlashCommands.js';
import { ChatTransferService, IChatTransferService } from '../../../chat/common/chatTransferService.js';
import { IChatVariablesService } from '../../../chat/common/chatVariables.js';
import { ChatWidgetHistoryService, IChatWidgetHistoryService } from '../../../chat/common/chatWidgetHistoryService.js';
import { ChatAgentLocation, ChatModeKind } from '../../../chat/common/constants.js';
import { ILanguageModelsService } from '../../../chat/common/languageModels.js';
import { ILanguageModelToolsService } from '../../../chat/common/languageModelToolsService.js';
import { NullLanguageModelsService } from '../../../chat/test/common/languageModels.js';
import { MockLanguageModelToolsService } from '../../../chat/test/common/mockLanguageModelToolsService.js';
import { IMcpService } from '../../../mcp/common/mcpTypes.js';
import { TestMcpService } from '../../../mcp/test/common/testMcpService.js';
import { IInlineChatSessionService } from '../../browser/inlineChatSessionService.js';
import { InlineChatSessionServiceImpl } from '../../browser/inlineChatSessionServiceImpl.js';
import { TestWorkerService } from './testWorkerService.js';
import { ChatWidgetService } from '../../../chat/browser/chatWidgetService.js';
suite('InlineChatSession', function () {
    const store = new DisposableStore();
    let editor;
    let model;
    let instaService;
    let inlineChatSessionService;
    setup(function () {
        const contextKeyService = new MockContextKeyService();
        const serviceCollection = new ServiceCollection([IConfigurationService, new TestConfigurationService()], [IChatVariablesService, new SyncDescriptor(ChatVariablesService)], [ILogService, new NullLogService()], [ITelemetryService, NullTelemetryService], [IExtensionService, new TestExtensionService()], [IContextKeyService, new MockContextKeyService()], [IViewsService, new TestExtensionService()], [IWorkspaceContextService, new TestContextService()], [IChatWidgetHistoryService, new SyncDescriptor(ChatWidgetHistoryService)], [IChatWidgetService, new SyncDescriptor(ChatWidgetService)], [IChatSlashCommandService, new SyncDescriptor(ChatSlashCommandService)], [IChatTransferService, new SyncDescriptor(ChatTransferService)], [IChatSessionsService, new SyncDescriptor(ChatSessionsService)], [IChatService, new SyncDescriptor(ChatService)], [IEditorWorkerService, new SyncDescriptor(TestWorkerService)], [IChatAgentService, new SyncDescriptor(ChatAgentService)], [IContextKeyService, contextKeyService], [IDiffProviderFactoryService, new SyncDescriptor(TestDiffProviderFactoryService)], [ILanguageModelsService, new SyncDescriptor(NullLanguageModelsService)], [IInlineChatSessionService, new SyncDescriptor(InlineChatSessionServiceImpl)], [ICommandService, new SyncDescriptor(TestCommandService)], [ILanguageModelToolsService, new MockLanguageModelToolsService()], [IMcpService, new TestMcpService()], [IEditorProgressService, new class extends mock() {
                show(total, delay) {
                    return {
                        total() { },
                        worked(value) { },
                        done() { },
                    };
                }
            }], [IChatEditingService, new class extends mock() {
                constructor() {
                    super(...arguments);
                    this.editingSessionsObs = constObservable([]);
                }
            }], [IChatAccessibilityService, new class extends mock() {
                acceptResponse(chatWidget, container, response, requestId) { }
                acceptRequest() { return -1; }
                acceptElicitation() { }
            }], [IAccessibleViewService, new class extends mock() {
                getOpenAriaHint(verbositySettingKey) {
                    return null;
                }
            }], [IQuickChatService, new class extends mock() {
            }], [IConfigurationService, new TestConfigurationService()], [IViewDescriptorService, new class extends mock() {
                constructor() {
                    super(...arguments);
                    this.onDidChangeLocation = Event.None;
                }
            }], [IWorkbenchAssignmentService, new NullWorkbenchAssignmentService()]);
        instaService = store.add(workbenchInstantiationService(undefined, store).createChild(serviceCollection));
        inlineChatSessionService = store.add(instaService.get(IInlineChatSessionService));
        store.add(instaService.get(IChatSessionsService)); // Needs to be disposed in between test runs to clear extensionPoint contribution
        instaService.get(IChatAgentService).registerDynamicAgent({
            extensionId: nullExtensionDescription.identifier,
            extensionVersion: undefined,
            publisherDisplayName: '',
            extensionDisplayName: '',
            extensionPublisherId: '',
            id: 'testAgent',
            name: 'testAgent',
            isDefault: true,
            locations: [ChatAgentLocation.EditorInline],
            modes: [ChatModeKind.Ask],
            metadata: {},
            slashCommands: [],
            disambiguation: [],
        }, {
            async invoke() {
                return {};
            }
        });
        store.add(instaService.get(IEditorWorkerService));
        model = store.add(instaService.get(IModelService).createModel('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven', null));
        editor = store.add(instantiateTestCodeEditor(instaService, model));
    });
    teardown(function () {
        store.clear();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    async function makeEditAsAi(edit) {
        const session = inlineChatSessionService.getSession(editor, editor.getModel().uri);
        assertType(session);
        session.hunkData.ignoreTextModelNChanges = true;
        try {
            editor.executeEdits('test', Array.isArray(edit) ? edit : [edit]);
        }
        finally {
            session.hunkData.ignoreTextModelNChanges = false;
        }
        await session.hunkData.recompute({ applied: 0, sha1: 'fakeSha1' });
    }
    function makeEdit(edit) {
        editor.executeEdits('test', Array.isArray(edit) ? edit : [edit]);
    }
    test('Create, release', async function () {
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        inlineChatSessionService.releaseSession(session);
    });
    test('HunkData, info', async function () {
        const decorationCountThen = model.getAllDecorations().length;
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        assert.ok(session.textModelN === model);
        await makeEditAsAi(EditOperation.insert(new Position(1, 1), 'AI_EDIT\n'));
        assert.strictEqual(session.hunkData.size, 1);
        let [hunk] = session.hunkData.getInfo();
        assertType(hunk);
        assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
        assert.strictEqual(hunk.getState(), 0 /* HunkState.Pending */);
        assert.ok(hunk.getRangesN()[0].equalsRange({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 8 }));
        await makeEditAsAi(EditOperation.insert(new Position(1, 3), 'foobar'));
        [hunk] = session.hunkData.getInfo();
        assert.ok(hunk.getRangesN()[0].equalsRange({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 14 }));
        inlineChatSessionService.releaseSession(session);
        assert.strictEqual(model.getAllDecorations().length, decorationCountThen); // no leaked decorations!
    });
    test('HunkData, accept', async function () {
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(1, 1), 'AI_EDIT\n'), EditOperation.insert(new Position(10, 1), 'AI_EDIT\n')]);
        assert.strictEqual(session.hunkData.size, 2);
        assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
        for (const hunk of session.hunkData.getInfo()) {
            assertType(hunk);
            assert.strictEqual(hunk.getState(), 0 /* HunkState.Pending */);
            hunk.acceptChanges();
            assert.strictEqual(hunk.getState(), 1 /* HunkState.Accepted */);
        }
        assert.strictEqual(session.textModel0.getValue(), session.textModelN.getValue());
        inlineChatSessionService.releaseSession(session);
    });
    test('HunkData, reject', async function () {
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(1, 1), 'AI_EDIT\n'), EditOperation.insert(new Position(10, 1), 'AI_EDIT\n')]);
        assert.strictEqual(session.hunkData.size, 2);
        assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
        for (const hunk of session.hunkData.getInfo()) {
            assertType(hunk);
            assert.strictEqual(hunk.getState(), 0 /* HunkState.Pending */);
            hunk.discardChanges();
            assert.strictEqual(hunk.getState(), 2 /* HunkState.Rejected */);
        }
        assert.strictEqual(session.textModel0.getValue(), session.textModelN.getValue());
        inlineChatSessionService.releaseSession(session);
    });
    test('HunkData, N rounds', async function () {
        model.setValue('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven\ntwelwe\nthirteen\nfourteen\nfifteen\nsixteen\nseventeen\neighteen\nnineteen\n');
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        assert.ok(session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
        assert.strictEqual(session.hunkData.size, 0);
        // ROUND #1
        await makeEditAsAi([
            EditOperation.insert(new Position(1, 1), 'AI1'),
            EditOperation.insert(new Position(4, 1), 'AI2'),
            EditOperation.insert(new Position(19, 1), 'AI3')
        ]);
        assert.strictEqual(session.hunkData.size, 2); // AI1, AI2 are merged into one hunk, AI3 is a separate hunk
        let [first, second] = session.hunkData.getInfo();
        assert.ok(model.getValueInRange(first.getRangesN()[0]).includes('AI1'));
        assert.ok(model.getValueInRange(first.getRangesN()[0]).includes('AI2'));
        assert.ok(model.getValueInRange(second.getRangesN()[0]).includes('AI3'));
        assert.ok(!session.textModel0.getValueInRange(first.getRangesN()[0]).includes('AI1'));
        assert.ok(!session.textModel0.getValueInRange(first.getRangesN()[0]).includes('AI2'));
        assert.ok(!session.textModel0.getValueInRange(second.getRangesN()[0]).includes('AI3'));
        first.acceptChanges();
        assert.ok(session.textModel0.getValueInRange(first.getRangesN()[0]).includes('AI1'));
        assert.ok(session.textModel0.getValueInRange(first.getRangesN()[0]).includes('AI2'));
        assert.ok(!session.textModel0.getValueInRange(second.getRangesN()[0]).includes('AI3'));
        // ROUND #2
        await makeEditAsAi([
            EditOperation.insert(new Position(7, 1), 'AI4'),
        ]);
        assert.strictEqual(session.hunkData.size, 2);
        [first, second] = session.hunkData.getInfo();
        assert.ok(model.getValueInRange(first.getRangesN()[0]).includes('AI4')); // the new hunk (in line-order)
        assert.ok(model.getValueInRange(second.getRangesN()[0]).includes('AI3')); // the previous hunk remains
        inlineChatSessionService.releaseSession(session);
    });
    test('HunkData, (mirror) edit before', async function () {
        const lines = ['one', 'two', 'three'];
        model.setValue(lines.join('\n'));
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(3, 1), 'AI WAS HERE\n')]);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'two', 'AI WAS HERE', 'three'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), lines.join('\n'));
        makeEdit([EditOperation.replace(new Range(1, 1, 1, 4), 'ONE')]);
        assert.strictEqual(session.textModelN.getValue(), ['ONE', 'two', 'AI WAS HERE', 'three'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['ONE', 'two', 'three'].join('\n'));
    });
    test('HunkData, (mirror) edit after', async function () {
        const lines = ['one', 'two', 'three', 'four', 'five'];
        model.setValue(lines.join('\n'));
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(3, 1), 'AI_EDIT\n')]);
        assert.strictEqual(session.hunkData.size, 1);
        const [hunk] = session.hunkData.getInfo();
        makeEdit([EditOperation.insert(new Position(1, 1), 'USER1')]);
        assert.strictEqual(session.textModelN.getValue(), ['USER1one', 'two', 'AI_EDIT', 'three', 'four', 'five'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['USER1one', 'two', 'three', 'four', 'five'].join('\n'));
        makeEdit([EditOperation.insert(new Position(5, 1), 'USER2')]);
        assert.strictEqual(session.textModelN.getValue(), ['USER1one', 'two', 'AI_EDIT', 'three', 'USER2four', 'five'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['USER1one', 'two', 'three', 'USER2four', 'five'].join('\n'));
        hunk.acceptChanges();
        assert.strictEqual(session.textModelN.getValue(), ['USER1one', 'two', 'AI_EDIT', 'three', 'USER2four', 'five'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['USER1one', 'two', 'AI_EDIT', 'three', 'USER2four', 'five'].join('\n'));
    });
    test('HunkData, (mirror) edit inside ', async function () {
        const lines = ['one', 'two', 'three'];
        model.setValue(lines.join('\n'));
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(3, 1), 'AI WAS HERE\n')]);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'two', 'AI WAS HERE', 'three'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), lines.join('\n'));
        makeEdit([EditOperation.replace(new Range(3, 4, 3, 7), 'wwaaassss')]);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'two', 'AI wwaaassss HERE', 'three'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['one', 'two', 'three'].join('\n'));
    });
    test('HunkData, (mirror) edit after dicard ', async function () {
        const lines = ['one', 'two', 'three'];
        model.setValue(lines.join('\n'));
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(3, 1), 'AI WAS HERE\n')]);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'two', 'AI WAS HERE', 'three'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), lines.join('\n'));
        assert.strictEqual(session.hunkData.size, 1);
        const [hunk] = session.hunkData.getInfo();
        hunk.discardChanges();
        assert.strictEqual(session.textModelN.getValue(), lines.join('\n'));
        assert.strictEqual(session.textModel0.getValue(), lines.join('\n'));
        makeEdit([EditOperation.replace(new Range(3, 4, 3, 6), '3333')]);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'two', 'thr3333'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['one', 'two', 'thr3333'].join('\n'));
    });
    test('HunkData, (mirror) edit after, multi turn', async function () {
        const lines = ['one', 'two', 'three', 'four', 'five'];
        model.setValue(lines.join('\n'));
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(3, 1), 'AI_EDIT\n')]);
        assert.strictEqual(session.hunkData.size, 1);
        makeEdit([EditOperation.insert(new Position(5, 1), 'FOO')]);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'two', 'AI_EDIT', 'three', 'FOOfour', 'five'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['one', 'two', 'three', 'FOOfour', 'five'].join('\n'));
        await makeEditAsAi([EditOperation.insert(new Position(2, 4), ' zwei')]);
        assert.strictEqual(session.hunkData.size, 1);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'two zwei', 'AI_EDIT', 'three', 'FOOfour', 'five'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['one', 'two', 'three', 'FOOfour', 'five'].join('\n'));
        makeEdit([EditOperation.replace(new Range(6, 3, 6, 5), 'vefivefi')]);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'two zwei', 'AI_EDIT', 'three', 'FOOfour', 'fivefivefi'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['one', 'two', 'three', 'FOOfour', 'fivefivefi'].join('\n'));
    });
    test('HunkData, (mirror) edit after, multi turn 2', async function () {
        const lines = ['one', 'two', 'three', 'four', 'five'];
        model.setValue(lines.join('\n'));
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(3, 1), 'AI_EDIT\n')]);
        assert.strictEqual(session.hunkData.size, 1);
        makeEdit([EditOperation.insert(new Position(5, 1), 'FOO')]);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'two', 'AI_EDIT', 'three', 'FOOfour', 'five'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['one', 'two', 'three', 'FOOfour', 'five'].join('\n'));
        await makeEditAsAi([EditOperation.insert(new Position(2, 4), 'zwei')]);
        assert.strictEqual(session.hunkData.size, 1);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'twozwei', 'AI_EDIT', 'three', 'FOOfour', 'five'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['one', 'two', 'three', 'FOOfour', 'five'].join('\n'));
        makeEdit([EditOperation.replace(new Range(6, 3, 6, 5), 'vefivefi')]);
        assert.strictEqual(session.textModelN.getValue(), ['one', 'twozwei', 'AI_EDIT', 'three', 'FOOfour', 'fivefivefi'].join('\n'));
        assert.strictEqual(session.textModel0.getValue(), ['one', 'two', 'three', 'FOOfour', 'fivefivefi'].join('\n'));
        session.hunkData.getInfo()[0].acceptChanges();
        assert.strictEqual(session.textModelN.getValue(), session.textModel0.getValue());
        makeEdit([EditOperation.replace(new Range(1, 1, 1, 1), 'done')]);
        assert.strictEqual(session.textModelN.getValue(), session.textModel0.getValue());
    });
    test('HunkData, accept, discardAll', async function () {
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(1, 1), 'AI_EDIT\n'), EditOperation.insert(new Position(10, 1), 'AI_EDIT\n')]);
        assert.strictEqual(session.hunkData.size, 2);
        assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
        const textModeNNow = session.textModelN.getValue();
        session.hunkData.getInfo()[0].acceptChanges();
        assert.strictEqual(textModeNNow, session.textModelN.getValue());
        session.hunkData.discardAll(); // all remaining
        assert.strictEqual(session.textModelN.getValue(), 'AI_EDIT\none\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven');
        assert.strictEqual(session.textModelN.getValue(), session.textModel0.getValue());
        inlineChatSessionService.releaseSession(session);
    });
    test('HunkData, discardAll return undo edits', async function () {
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.insert(new Position(1, 1), 'AI_EDIT\n'), EditOperation.insert(new Position(10, 1), 'AI_EDIT\n')]);
        assert.strictEqual(session.hunkData.size, 2);
        assert.ok(!session.textModel0.equalsTextBuffer(session.textModelN.getTextBuffer()));
        const textModeNNow = session.textModelN.getValue();
        session.hunkData.getInfo()[0].acceptChanges();
        assert.strictEqual(textModeNNow, session.textModelN.getValue());
        const undoEdits = session.hunkData.discardAll(); // all remaining
        assert.strictEqual(session.textModelN.getValue(), 'AI_EDIT\none\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven');
        assert.strictEqual(session.textModelN.getValue(), session.textModel0.getValue());
        // undo the discards
        session.textModelN.pushEditOperations(null, undoEdits, () => null);
        assert.strictEqual(textModeNNow, session.textModelN.getValue());
        inlineChatSessionService.releaseSession(session);
    });
    test('Pressing Escape after inline chat errored with "response filtered" leaves document dirty #7764', async function () {
        const origValue = `class Foo {
	private onError(error: string): void {
		if (/The request timed out|The network connection was lost/i.test(error)) {
			return;
		}

		error = error.replace(/See https:\/\/github\.com\/Squirrel\/Squirrel\.Mac\/issues\/182 for more information/, 'This might mean the application was put on quarantine by macOS. See [this link](https://github.com/microsoft/vscode/issues/7426#issuecomment-425093469) for more information');

		this.notificationService.notify({
			severity: Severity.Error,
			message: error,
			source: nls.localize('update service', "Update Service"),
		});
	}
}`;
        model.setValue(origValue);
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        const fakeRequest = new class extends mock() {
            get id() { return 'one'; }
        };
        session.markModelVersion(fakeRequest);
        assert.strictEqual(editor.getModel().getLineCount(), 15);
        await makeEditAsAi([EditOperation.replace(new Range(7, 1, 7, Number.MAX_SAFE_INTEGER), `error = error.replace(
			/See https:\/\/github\.com\/Squirrel\/Squirrel\.Mac\/issues\/182 for more information/,
			'This might mean the application was put on quarantine by macOS. See [this link](https://github.com/microsoft/vscode/issues/7426#issuecomment-425093469) for more information'
		);`)]);
        assert.strictEqual(editor.getModel().getLineCount(), 18);
        // called when a response errors out
        await session.undoChangesUntil(fakeRequest.id);
        await session.hunkData.recompute({ applied: 0, sha1: 'fakeSha1' }, undefined);
        assert.strictEqual(editor.getModel().getValue(), origValue);
        session.hunkData.discardAll(); // called when dimissing the session
        assert.strictEqual(editor.getModel().getValue(), origValue);
    });
    test('Apply Code\'s preview should be easier to undo/esc #7537', async function () {
        model.setValue(`export function fib(n) {
	if (n <= 0) return 0;
	if (n === 1) return 0;
	if (n === 2) return 1;
	return fib(n - 1) + fib(n - 2);
}`);
        const session = await inlineChatSessionService.createSession(editor, {}, CancellationToken.None);
        assertType(session);
        await makeEditAsAi([EditOperation.replace(new Range(5, 1, 6, Number.MAX_SAFE_INTEGER), `
	let a = 0, b = 1, c;
	for (let i = 3; i <= n; i++) {
		c = a + b;
		a = b;
		b = c;
	}
	return b;
}`)]);
        assert.strictEqual(session.hunkData.size, 1);
        assert.strictEqual(session.hunkData.pending, 1);
        assert.ok(session.hunkData.getInfo().every(d => d.getState() === 0 /* HunkState.Pending */));
        await assertSnapshot(editor.getModel().getValue(), { name: '1' });
        await model.undo();
        await assertSnapshot(editor.getModel().getValue(), { name: '2' });
        // overlapping edits (even UNDO) mark edits as accepted
        assert.strictEqual(session.hunkData.size, 1);
        assert.strictEqual(session.hunkData.pending, 0);
        assert.ok(session.hunkData.getInfo().every(d => d.getState() === 1 /* HunkState.Accepted */));
        // no further change when discarding
        session.hunkData.discardAll(); // CANCEL
        await assertSnapshot(editor.getModel().getValue(), { name: '2' });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ2hhdFNlc3Npb24udGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L3Rlc3QvYnJvd3Nlci9pbmxpbmVDaGF0U2Vzc2lvbi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBZSxlQUFlLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN4RixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDakUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVuRyxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUM1SCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDbkYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUVuRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDL0UsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sMkVBQTJFLENBQUM7QUFDM0gsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDOUYsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDakcsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDekcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBQ3pILE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUM3RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUV0RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUNoSCxPQUFPLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxzQkFBc0IsRUFBbUIsTUFBTSxxREFBcUQsQ0FBQztBQUM5RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNsRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNyRSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUMxRyxPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxzRUFBc0UsQ0FBQztBQUN0SCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNuSCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFNUcsT0FBTyxFQUFFLHlCQUF5QixFQUFFLGtCQUFrQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDakgsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDekYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFOUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDekYsT0FBTyxFQUFFLG1CQUFtQixFQUF1QixNQUFNLDRDQUE0QyxDQUFDO0FBRXRHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDdEUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLHdCQUF3QixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDOUcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDeEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFOUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLHlCQUF5QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDdkgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQy9GLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzNHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFNUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDdEYsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDN0YsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFL0UsS0FBSyxDQUFDLG1CQUFtQixFQUFFO0lBRTFCLE1BQU0sS0FBSyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7SUFDcEMsSUFBSSxNQUF5QixDQUFDO0lBQzlCLElBQUksS0FBaUIsQ0FBQztJQUN0QixJQUFJLFlBQXNDLENBQUM7SUFFM0MsSUFBSSx3QkFBbUQsQ0FBQztJQUV4RCxLQUFLLENBQUM7UUFDTCxNQUFNLGlCQUFpQixHQUFHLElBQUkscUJBQXFCLEVBQUUsQ0FBQztRQUd0RCxNQUFNLGlCQUFpQixHQUFHLElBQUksaUJBQWlCLENBQzlDLENBQUMscUJBQXFCLEVBQUUsSUFBSSx3QkFBd0IsRUFBRSxDQUFDLEVBQ3ZELENBQUMscUJBQXFCLEVBQUUsSUFBSSxjQUFjLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxFQUNqRSxDQUFDLFdBQVcsRUFBRSxJQUFJLGNBQWMsRUFBRSxDQUFDLEVBQ25DLENBQUMsaUJBQWlCLEVBQUUsb0JBQW9CLENBQUMsRUFDekMsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLG9CQUFvQixFQUFFLENBQUMsRUFDL0MsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLHFCQUFxQixFQUFFLENBQUMsRUFDakQsQ0FBQyxhQUFhLEVBQUUsSUFBSSxvQkFBb0IsRUFBRSxDQUFDLEVBQzNDLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxrQkFBa0IsRUFBRSxDQUFDLEVBQ3BELENBQUMseUJBQXlCLEVBQUUsSUFBSSxjQUFjLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxFQUN6RSxDQUFDLGtCQUFrQixFQUFFLElBQUksY0FBYyxDQUFDLGlCQUFpQixDQUFDLENBQUMsRUFDM0QsQ0FBQyx3QkFBd0IsRUFBRSxJQUFJLGNBQWMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLEVBQ3ZFLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxjQUFjLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxFQUMvRCxDQUFDLG9CQUFvQixFQUFFLElBQUksY0FBYyxDQUFDLG1CQUFtQixDQUFDLENBQUMsRUFDL0QsQ0FBQyxZQUFZLEVBQUUsSUFBSSxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUMsRUFDL0MsQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEVBQzdELENBQUMsaUJBQWlCLEVBQUUsSUFBSSxjQUFjLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxFQUN6RCxDQUFDLGtCQUFrQixFQUFFLGlCQUFpQixDQUFDLEVBQ3ZDLENBQUMsMkJBQTJCLEVBQUUsSUFBSSxjQUFjLENBQUMsOEJBQThCLENBQUMsQ0FBQyxFQUNqRixDQUFDLHNCQUFzQixFQUFFLElBQUksY0FBYyxDQUFDLHlCQUF5QixDQUFDLENBQUMsRUFDdkUsQ0FBQyx5QkFBeUIsRUFBRSxJQUFJLGNBQWMsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDLEVBQzdFLENBQUMsZUFBZSxFQUFFLElBQUksY0FBYyxDQUFDLGtCQUFrQixDQUFDLENBQUMsRUFDekQsQ0FBQywwQkFBMEIsRUFBRSxJQUFJLDZCQUE2QixFQUFFLENBQUMsRUFDakUsQ0FBQyxXQUFXLEVBQUUsSUFBSSxjQUFjLEVBQUUsQ0FBQyxFQUNuQyxDQUFDLHNCQUFzQixFQUFFLElBQUksS0FBTSxTQUFRLElBQUksRUFBMEI7Z0JBQy9ELElBQUksQ0FBQyxLQUFjLEVBQUUsS0FBZTtvQkFDNUMsT0FBTzt3QkFDTixLQUFLLEtBQUssQ0FBQzt3QkFDWCxNQUFNLENBQUMsS0FBSyxJQUFJLENBQUM7d0JBQ2pCLElBQUksS0FBSyxDQUFDO3FCQUNWLENBQUM7Z0JBQ0gsQ0FBQzthQUNELENBQUMsRUFDRixDQUFDLG1CQUFtQixFQUFFLElBQUksS0FBTSxTQUFRLElBQUksRUFBdUI7Z0JBQXpDOztvQkFDaEIsdUJBQWtCLEdBQWdELGVBQWUsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDaEcsQ0FBQzthQUFBLENBQUMsRUFDRixDQUFDLHlCQUF5QixFQUFFLElBQUksS0FBTSxTQUFRLElBQUksRUFBNkI7Z0JBQ3JFLGNBQWMsQ0FBQyxVQUFzQixFQUFFLFNBQXNCLEVBQUUsUUFBNEMsRUFBRSxTQUFpQixJQUFVLENBQUM7Z0JBQ3pJLGFBQWEsS0FBYSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEMsaUJBQWlCLEtBQVcsQ0FBQzthQUN0QyxDQUFDLEVBQ0YsQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLEtBQU0sU0FBUSxJQUFJLEVBQTBCO2dCQUMvRCxlQUFlLENBQUMsbUJBQW9EO29CQUM1RSxPQUFPLElBQUksQ0FBQztnQkFDYixDQUFDO2FBQ0QsQ0FBQyxFQUNGLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxLQUFNLFNBQVEsSUFBSSxFQUFxQjthQUFJLENBQUMsRUFDcEUsQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLHdCQUF3QixFQUFFLENBQUMsRUFDdkQsQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLEtBQU0sU0FBUSxJQUFJLEVBQTBCO2dCQUE1Qzs7b0JBQ25CLHdCQUFtQixHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7Z0JBQzNDLENBQUM7YUFBQSxDQUFDLEVBQ0YsQ0FBQywyQkFBMkIsRUFBRSxJQUFJLDhCQUE4QixFQUFFLENBQUMsQ0FDbkUsQ0FBQztRQUlGLFlBQVksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBQ3pHLHdCQUF3QixHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7UUFDbEYsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUF3QixDQUFDLENBQUMsQ0FBRSxpRkFBaUY7UUFFNUosWUFBWSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLG9CQUFvQixDQUFDO1lBQ3hELFdBQVcsRUFBRSx3QkFBd0IsQ0FBQyxVQUFVO1lBQ2hELGdCQUFnQixFQUFFLFNBQVM7WUFDM0Isb0JBQW9CLEVBQUUsRUFBRTtZQUN4QixvQkFBb0IsRUFBRSxFQUFFO1lBQ3hCLG9CQUFvQixFQUFFLEVBQUU7WUFDeEIsRUFBRSxFQUFFLFdBQVc7WUFDZixJQUFJLEVBQUUsV0FBVztZQUNqQixTQUFTLEVBQUUsSUFBSTtZQUNmLFNBQVMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQztZQUMzQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDO1lBQ3pCLFFBQVEsRUFBRSxFQUFFO1lBQ1osYUFBYSxFQUFFLEVBQUU7WUFDakIsY0FBYyxFQUFFLEVBQUU7U0FDbEIsRUFBRTtZQUNGLEtBQUssQ0FBQyxNQUFNO2dCQUNYLE9BQU8sRUFBRSxDQUFDO1lBQ1gsQ0FBQztTQUNELENBQUMsQ0FBQztRQUdILEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBc0IsQ0FBQyxDQUFDO1FBQ3ZFLEtBQUssR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsV0FBVyxDQUFDLG1FQUFtRSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDMUksTUFBTSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDcEUsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUM7UUFDUixLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDZixDQUFDLENBQUMsQ0FBQztJQUVILHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsS0FBSyxVQUFVLFlBQVksQ0FBQyxJQUFxQztRQUNoRSxNQUFNLE9BQU8sR0FBRyx3QkFBd0IsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxRQUFRLEVBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNwRixVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEIsT0FBTyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUM7UUFDaEQsSUFBSSxDQUFDO1lBQ0osTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbEUsQ0FBQztnQkFBUyxDQUFDO1lBQ1YsT0FBTyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsR0FBRyxLQUFLLENBQUM7UUFDbEQsQ0FBQztRQUNELE1BQU0sT0FBTyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFRCxTQUFTLFFBQVEsQ0FBQyxJQUFxQztRQUN0RCxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQsSUFBSSxDQUFDLGlCQUFpQixFQUFFLEtBQUs7UUFFNUIsTUFBTSxPQUFPLEdBQUcsTUFBTSx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEIsd0JBQXdCLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2xELENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdCQUFnQixFQUFFLEtBQUs7UUFFM0IsTUFBTSxtQkFBbUIsR0FBRyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFFN0QsTUFBTSxPQUFPLEdBQUcsTUFBTSx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBVSxLQUFLLEtBQUssQ0FBQyxDQUFDO1FBRXhDLE1BQU0sWUFBWSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFHMUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN4QyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFakIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDcEYsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLDRCQUFvQixDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLGVBQWUsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsRUFBRSxhQUFhLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFcEgsTUFBTSxZQUFZLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUN2RSxDQUFDLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLEVBQUUsZUFBZSxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxFQUFFLGFBQWEsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUVySCx3QkFBd0IsQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLHlCQUF5QjtJQUNyRyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxrQkFBa0IsRUFBRSxLQUFLO1FBRTdCLE1BQU0sT0FBTyxHQUFHLE1BQU0sd0JBQXdCLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXBCLE1BQU0sWUFBWSxDQUFDLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLEVBQUUsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXBJLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0MsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFcEYsS0FBSyxNQUFNLElBQUksSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7WUFDL0MsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSw0QkFBb0IsQ0FBQztZQUN2RCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDckIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLDZCQUFxQixDQUFDO1FBQ3pELENBQUM7UUFFRCxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ2pGLHdCQUF3QixDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNsRCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxrQkFBa0IsRUFBRSxLQUFLO1FBRTdCLE1BQU0sT0FBTyxHQUFHLE1BQU0sd0JBQXdCLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXBCLE1BQU0sWUFBWSxDQUFDLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLEVBQUUsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXBJLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0MsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFcEYsS0FBSyxNQUFNLElBQUksSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7WUFDL0MsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSw0QkFBb0IsQ0FBQztZQUN2RCxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDdEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLDZCQUFxQixDQUFDO1FBQ3pELENBQUM7UUFFRCxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ2pGLHdCQUF3QixDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNsRCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxvQkFBb0IsRUFBRSxLQUFLO1FBRS9CLEtBQUssQ0FBQyxRQUFRLENBQUMsa0pBQWtKLENBQUMsQ0FBQztRQUVuSyxNQUFNLE9BQU8sR0FBRyxNQUFNLHdCQUF3QixDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pHLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVwQixNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFbkYsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU3QyxXQUFXO1FBQ1gsTUFBTSxZQUFZLENBQUM7WUFDbEIsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDO1lBQy9DLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQztZQUMvQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUM7U0FDaEQsQ0FBQyxDQUFDO1FBRUgsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLDREQUE0RDtRQUUxRyxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7UUFFakQsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3hFLE1BQU0sQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN4RSxNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFFekUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3RGLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN0RixNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFFdkYsS0FBSyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3RCLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDckYsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNyRixNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxD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QyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlELE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDM0gsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsVUFBVSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRWhILElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNyQixNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzNILE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDNUgsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsaUNBQWlDLEVBQUUsS0FBSztRQUU1QyxNQUFNLEtBQUssR0FBRyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdEMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDakMsTUFBTSxPQUFPLEdBQUcsTUFBTSx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFcEIsTUFBTSxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEYsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDckcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVwRSxRQUFRLENBQUMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0RSxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzNHLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDdkYsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsdUNBQXVDLEVBQUUsS0FBSztRQUVsRCxNQUFNLEtBQUssR0FBRyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdEMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDakMsTUFBTSxPQUFPLEdBQUcsTUFBTSx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFcEIsTUFBTSxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEYsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDckcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVwRSxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQzFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN0QixNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFcEUsUUFBUSxDQUFDLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN4RixNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3pGLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDJDQUEyQyxFQUFFLEtBQUs7UUFFdEQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdEQsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFakMsTUFBTSxPQUFPLEdBQUcsTUFBTSx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFcEIsTUFBTSxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFNUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU3QyxRQUFRLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNwSCxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFekcsTUFBTSxZQUFZLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU3QyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3pILE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUV6RyxRQUFRLENBQUMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyRSxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQy9ILE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNoSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw2Q0FBNkMsRUFBRSxLQUFLO1FBRXhELE1BQU0sS0FBSyxHQUFHLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3RELEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRWpDLE1BQU0sT0FBTyxHQUFHLE1BQU0sd0JBQXdCLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXBCLE1BQU0sWUFBWSxDQUFDLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVFLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFN0MsUUFBUSxDQUFDLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVELE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDcEgsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRXpHLE1BQU0sWUFBWSxDQUFDLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFN0MsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMs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