/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { LanguageModelToolsService } from '../../browser/languageModelToolsService.js';
import { IChatService } from '../../common/chatService.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../common/languageModelToolsService.js';
import { MockChatService } from '../common/mockChatService.js';
import { ChatSelectedTools } from '../../browser/chatSelectedTools.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { ChatMode } from '../../common/chatModes.js';
suite('ChatSelectedTools', () => {
    let store;
    let toolsService;
    let selectedTools;
    setup(() => {
        store = new DisposableStore();
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(new TestConfigurationService)),
        }, store);
        instaService.stub(IChatService, new MockChatService());
        instaService.stub(ILanguageModelToolsService, instaService.createInstance(LanguageModelToolsService));
        store.add(instaService);
        toolsService = instaService.get(ILanguageModelToolsService);
        selectedTools = store.add(instaService.createInstance(ChatSelectedTools, constObservable(ChatMode.Agent)));
    });
    teardown(function () {
        store.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    const mcpSource = { type: 'mcp', label: 'MCP', collectionId: '', definitionId: '', instructions: '', serverLabel: '' };
    test('Can\'t enable/disable MCP tools directly #18161', () => {
        return runWithFakedTimers({}, async () => {
            const toolData1 = {
                id: 'testTool1',
                modelDescription: 'Test Tool 1',
                displayName: 'Test Tool 1',
                canBeReferencedInPrompt: true,
                toolReferenceName: 't1',
                source: mcpSource,
            };
            const toolData2 = {
                id: 'testTool2',
                modelDescription: 'Test Tool 2',
                displayName: 'Test Tool 2',
                source: mcpSource,
                canBeReferencedInPrompt: true,
                toolReferenceName: 't2',
            };
            const toolData3 = {
                id: 'testTool3',
                modelDescription: 'Test Tool 3',
                displayName: 'Test Tool 3',
                source: mcpSource,
                canBeReferencedInPrompt: true,
                toolReferenceName: 't3',
            };
            const toolset = toolsService.createToolSet(mcpSource, 'mcp', 'mcp');
            store.add(toolsService.registerToolData(toolData1));
            store.add(toolsService.registerToolData(toolData2));
            store.add(toolsService.registerToolData(toolData3));
            store.add(toolset);
            store.add(toolset.addTool(toolData1));
            store.add(toolset.addTool(toolData2));
            store.add(toolset.addTool(toolData3));
            assert.strictEqual(Iterable.length(toolsService.getTools()), 3);
            const size = Iterable.length(toolset.getTools());
            assert.strictEqual(size, 3);
            await timeout(1000); // UGLY the tools service updates its state sync but emits the event async (750ms) delay. This affects the observable that depends on the event
            assert.strictEqual(selectedTools.entriesMap.get().size, 7); // 1 toolset (+3 vscode, execute, read toolsets), 3 tools
            const toSet = new Map([[toolData1, true], [toolData2, false], [toolData3, false], [toolset, false]]);
            selectedTools.set(toSet, false);
            const userSelectedTools = selectedTools.userSelectedTools.get();
            assert.strictEqual(Object.keys(userSelectedTools).length, 3); // 3 tools
            assert.strictEqual(userSelectedTools[toolData1.id], true);
            assert.strictEqual(userSelectedTools[toolData2.id], false);
            assert.strictEqual(userSelectedTools[toolData3.id], false);
        });
    });
    test('Can still enable/disable user toolsets #251640', () => {
        return runWithFakedTimers({}, async () => {
            const toolData1 = {
                id: 'testTool1',
                modelDescription: 'Test Tool 1',
                displayName: 'Test Tool 1',
                canBeReferencedInPrompt: true,
                toolReferenceName: 't1',
                source: ToolDataSource.Internal,
            };
            const toolData2 = {
                id: 'testTool2',
                modelDescription: 'Test Tool 2',
                displayName: 'Test Tool 2',
                source: mcpSource,
                canBeReferencedInPrompt: true,
                toolReferenceName: 't2',
            };
            const toolData3 = {
                id: 'testTool3',
                modelDescription: 'Test Tool 3',
                displayName: 'Test Tool 3',
                source: ToolDataSource.Internal,
                canBeReferencedInPrompt: true,
                toolReferenceName: 't3',
            };
            const toolset = toolsService.createToolSet({ type: 'user', label: 'User Toolset', file: URI.file('/userToolset.json') }, 'userToolset', 'userToolset');
            store.add(toolsService.registerToolData(toolData1));
            store.add(toolsService.registerToolData(toolData2));
            store.add(toolsService.registerToolData(toolData3));
            store.add(toolset);
            store.add(toolset.addTool(toolData1));
            store.add(toolset.addTool(toolData2));
            store.add(toolset.addTool(toolData3));
            assert.strictEqual(Iterable.length(toolsService.getTools()), 3);
            const size = Iterable.length(toolset.getTools());
            assert.strictEqual(size, 3);
            await timeout(1000); // UGLY the tools service updates its state sync but emits the event async (750ms) delay. This affects the observable that depends on the event
            assert.strictEqual(selectedTools.entriesMap.get().size, 7); // 1 toolset (+3 vscode, execute, read toolsets), 3 tools
            // Toolset is checked, tools 2 and 3 are unchecked
            const toSet = new Map([[toolData1, true], [toolData2, false], [toolData3, false], [toolset, true]]);
            selectedTools.set(toSet, false);
            const userSelectedTools = selectedTools.userSelectedTools.get();
            assert.strictEqual(Object.keys(userSelectedTools).length, 3); // 3 tools
            // User toolset is enabled - all tools are enabled
            assert.strictEqual(userSelectedTools[toolData1.id], true);
            assert.strictEqual(userSelectedTools[toolData2.id], true);
            assert.strictEqual(userSelectedTools[toolData3.id], true);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlbGVjdGVkVG9vbHMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvYnJvd3Nlci9jaGF0U2VsZWN0ZWRUb29scy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN6SCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxpRUFBaUUsQ0FBQztBQUNwRyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN2RixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDM0QsT0FBTyxFQUFFLDBCQUEwQixFQUFhLGNBQWMsRUFBVyxNQUFNLDJDQUEyQyxDQUFDO0FBQzNILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN2RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDM0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM1RixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFN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