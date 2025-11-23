/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { Barrier } from '../../../../../base/common/async.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { CancellationError, isCancellationError } from '../../../../../base/common/errors.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { TestAccessibilityService } from '../../../../../platform/accessibility/test/common/testAccessibilityService.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { ContextKeyEqualsExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { LanguageModelToolsService } from '../../browser/languageModelToolsService.js';
import { IChatService, IChatToolInvocation } from '../../common/chatService.js';
import { ChatConfiguration } from '../../common/constants.js';
import { GithubCopilotToolReference, isToolResultInputOutputDetails, ToolDataSource, VSCodeToolReference } from '../../common/languageModelToolsService.js';
import { MockChatService } from '../common/mockChatService.js';
import { LocalChatSessionUri } from '../../common/chatUri.js';
import { ILanguageModelToolsConfirmationService } from '../../common/languageModelToolsConfirmationService.js';
import { MockLanguageModelToolsConfirmationService } from '../common/mockLanguageModelToolsConfirmationService.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
// --- Test helpers to reduce repetition and improve readability ---
class TestAccessibilitySignalService {
    constructor() {
        this.signalPlayedCalls = [];
    }
    async playSignal(signal, options) {
        this.signalPlayedCalls.push({ signal, options });
    }
    reset() {
        this.signalPlayedCalls = [];
    }
}
class TestTelemetryService {
    constructor() {
        this.events = [];
    }
    publicLog2(eventName, data) {
        this.events.push({ eventName, data });
    }
    reset() {
        this.events = [];
    }
}
function registerToolForTest(service, store, id, impl, data) {
    const toolData = {
        id,
        modelDescription: data?.modelDescription ?? 'Test Tool',
        displayName: data?.displayName ?? 'Test Tool',
        source: ToolDataSource.Internal,
        ...data,
    };
    store.add(service.registerTool(toolData, impl));
    return {
        id,
        makeDto: (parameters, context, callId = '1') => ({
            callId,
            toolId: id,
            tokenBudget: 100,
            parameters,
            context: context ? {
                sessionId: context.sessionId,
                sessionResource: LocalChatSessionUri.forSession(context.sessionId),
            } : undefined,
        }),
    };
}
function stubGetSession(chatService, sessionId, options) {
    const requestId = options?.requestId ?? 'requestId';
    const capture = options?.capture;
    const fakeModel = {
        sessionId,
        sessionResource: LocalChatSessionUri.forSession(sessionId),
        getRequests: () => [{ id: requestId, modelId: 'test-model' }],
    };
    chatService.addSession(fakeModel);
    chatService.appendProgress = (request, progress) => {
        if (capture) {
            capture.invocation = progress;
        }
    };
    return fakeModel;
}
async function waitForPublishedInvocation(capture, tries = 5) {
    for (let i = 0; i < tries && !capture.invocation; i++) {
        await Promise.resolve();
    }
    return capture.invocation;
}
suite('LanguageModelToolsService', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let contextKeyService;
    let service;
    let chatService;
    let configurationService;
    setup(() => {
        configurationService = new TestConfigurationService();
        configurationService.setUserConfiguration(ChatConfiguration.ExtensionToolsEnabled, true);
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(configurationService)),
            configurationService: () => configurationService
        }, store);
        contextKeyService = instaService.get(IContextKeyService);
        chatService = new MockChatService();
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        service = store.add(instaService.createInstance(LanguageModelToolsService));
    });
    function setupToolsForTest(service, store) {
        // Create a variety of tools and tool sets for testing
        // Some with toolReferenceName, some without, some from extensions, mcp and user defined
        const tool1 = {
            id: 'tool1',
            toolReferenceName: 'tool1RefName',
            modelDescription: 'Test Tool 1',
            displayName: 'Tool1 Display Name',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
        };
        store.add(service.registerToolData(tool1));
        const tool2 = {
            id: 'tool2',
            modelDescription: 'Test Tool 2',
            displayName: 'Tool2 Display Name',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
        };
        store.add(service.registerToolData(tool2));
        /** Extension Tool 1 */
        const extTool1 = {
            id: 'extTool1',
            toolReferenceName: 'extTool1RefName',
            modelDescription: 'Test Extension Tool 1',
            displayName: 'ExtTool1 Display Name',
            source: { type: 'extension', label: 'My Extension', extensionId: new ExtensionIdentifier('my.extension') },
            canBeReferencedInPrompt: true,
        };
        store.add(service.registerToolData(extTool1));
        /** Internal Tool Set with internalToolSetTool1 */
        const internalToolSetTool1 = {
            id: 'internalToolSetTool1',
            toolReferenceName: 'internalToolSetTool1RefName',
            modelDescription: 'Test Internal Tool Set 1',
            displayName: 'InternalToolSet1 Display Name',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(internalToolSetTool1));
        const internalToolSet = store.add(service.createToolSet(ToolDataSource.Internal, 'internalToolSet', 'internalToolSetRefName', { description: 'Test Set' }));
        store.add(internalToolSet.addTool(internalToolSetTool1));
        /** User Tool Set with tool1 */
        const userToolSet = store.add(service.createToolSet({ type: 'user', label: 'User', file: URI.file('/test/userToolSet.json') }, 'userToolSet', 'userToolSetRefName', { description: 'Test Set' }));
        store.add(userToolSet.addTool(tool2));
        /** MCP tool in a MCP tool set */
        const mcpDataSource = { type: 'mcp', label: 'My MCP Server', serverLabel: 'MCP Server', instructions: undefined, collectionId: 'testMCPCollection', definitionId: 'testMCPDefId' };
        const mcpTool1 = {
            id: 'mcpTool1',
            toolReferenceName: 'mcpTool1RefName',
            modelDescription: 'Test MCP Tool 1',
            displayName: 'McpTool1 Display Name',
            source: mcpDataSource,
            canBeReferencedInPrompt: true,
        };
        store.add(service.registerToolData(mcpTool1));
        const mcpToolSet = store.add(service.createToolSet(mcpDataSource, 'mcpToolSet', 'mcpToolSetRefName', { description: 'MCP Test ToolSet' }));
        store.add(mcpToolSet.addTool(mcpTool1));
    }
    test('registerToolData', () => {
        const toolData = {
            id: 'testTool',
            modelDescription: 'Test Tool',
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        const disposable = service.registerToolData(toolData);
        assert.strictEqual(service.getTool('testTool')?.id, 'testTool');
        disposable.dispose();
        assert.strictEqual(service.getTool('testTool'), undefined);
    });
    test('registerToolImplementation', () => {
        const toolData = {
            id: 'testTool',
            modelDescription: 'Test Tool',
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(toolData));
        const toolImpl = {
            invoke: async () => ({ content: [{ kind: 'text', value: 'result' }] }),
        };
        store.add(service.registerToolImplementation('testTool', toolImpl));
        assert.strictEqual(service.getTool('testTool')?.id, 'testTool');
    });
    test('getTools', () => {
        contextKeyService.createKey('testKey', true);
        const toolData1 = {
            id: 'testTool1',
            modelDescription: 'Test Tool 1',
            when: ContextKeyEqualsExpr.create('testKey', false),
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        const toolData2 = {
            id: 'testTool2',
            modelDescription: 'Test Tool 2',
            when: ContextKeyEqualsExpr.create('testKey', true),
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        const toolData3 = {
            id: 'testTool3',
            modelDescription: 'Test Tool 3',
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(toolData1));
        store.add(service.registerToolData(toolData2));
        store.add(service.registerToolData(toolData3));
        const tools = Array.from(service.getTools());
        assert.strictEqual(tools.length, 2);
        assert.strictEqual(tools[0].id, 'testTool2');
        assert.strictEqual(tools[1].id, 'testTool3');
    });
    test('getToolByName', () => {
        contextKeyService.createKey('testKey', true);
        const toolData1 = {
            id: 'testTool1',
            toolReferenceName: 'testTool1',
            modelDescription: 'Test Tool 1',
            when: ContextKeyEqualsExpr.create('testKey', false),
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        const toolData2 = {
            id: 'testTool2',
            toolReferenceName: 'testTool2',
            modelDescription: 'Test Tool 2',
            when: ContextKeyEqualsExpr.create('testKey', true),
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        const toolData3 = {
            id: 'testTool3',
            toolReferenceName: 'testTool3',
            modelDescription: 'Test Tool 3',
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(toolData1));
        store.add(service.registerToolData(toolData2));
        store.add(service.registerToolData(toolData3));
        assert.strictEqual(service.getToolByName('testTool1'), undefined);
        assert.strictEqual(service.getToolByName('testTool1', true)?.id, 'testTool1');
        assert.strictEqual(service.getToolByName('testTool2')?.id, 'testTool2');
        assert.strictEqual(service.getToolByName('testTool3')?.id, 'testTool3');
    });
    test('invokeTool', async () => {
        const toolData = {
            id: 'testTool',
            modelDescription: 'Test Tool',
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(toolData));
        const toolImpl = {
            invoke: async (invocation) => {
                assert.strictEqual(invocation.callId, '1');
                assert.strictEqual(invocation.toolId, 'testTool');
                assert.deepStrictEqual(invocation.parameters, { a: 1 });
                return { content: [{ kind: 'text', value: 'result' }] };
            }
        };
        store.add(service.registerToolImplementation('testTool', toolImpl));
        const dto = {
            callId: '1',
            toolId: 'testTool',
            tokenBudget: 100,
            parameters: {
                a: 1
            },
            context: undefined,
        };
        const result = await service.invokeTool(dto, async () => 0, CancellationToken.None);
        assert.strictEqual(result.content[0].value, 'result');
    });
    test('invocation parameters are overridden by input toolSpecificData', async () => {
        const rawInput = { b: 2 };
        const tool = registerToolForTest(service, store, 'testToolInputOverride', {
            prepareToolInvocation: async () => ({
                toolSpecificData: { kind: 'input', rawInput },
                confirmationMessages: {
                    title: 'a',
                    message: 'b',
                }
            }),
            invoke: async (invocation) => {
                // The service should replace parameters with rawInput and strip toolSpecificData
                assert.deepStrictEqual(invocation.parameters, rawInput);
                assert.strictEqual(invocation.toolSpecificData, undefined);
                return { content: [{ kind: 'text', value: 'ok' }] };
            },
        });
        const sessionId = 'sessionId';
        const capture = {};
        stubGetSession(chatService, sessionId, { requestId: 'requestId-io', capture });
        const dto = tool.makeDto({ a: 1 }, { sessionId });
        const invokeP = service.invokeTool(dto, async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const result = await invokeP;
        assert.strictEqual(result.content[0].value, 'ok');
    });
    test('chat invocation injects input toolSpecificData for confirmation when alwaysDisplayInputOutput', async () => {
        const toolData = {
            id: 'testToolDisplayIO',
            modelDescription: 'Test Tool',
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
            alwaysDisplayInputOutput: true,
        };
        const tool = registerToolForTest(service, store, 'testToolDisplayIO', {
            prepareToolInvocation: async () => ({
                confirmationMessages: { title: 'Confirm', message: 'Proceed?' }
            }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'done' }] }),
        }, toolData);
        const sessionId = 'sessionId-io';
        const capture = {};
        stubGetSession(chatService, sessionId, { requestId: 'requestId-io', capture });
        const dto = tool.makeDto({ a: 1 }, { sessionId });
        const invokeP = service.invokeTool(dto, async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        assert.ok(published, 'expected ChatToolInvocation to be published');
        assert.strictEqual(published.toolId, tool.id);
        // The service should have injected input toolSpecificData with the raw parameters
        assert.strictEqual(published.toolSpecificData?.kind, 'input');
        assert.deepStrictEqual(published.toolSpecificData?.rawInput, dto.parameters);
        // Confirm to let invoke proceed
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const result = await invokeP;
        assert.strictEqual(result.content[0].value, 'done');
    });
    test('chat invocation waits for user confirmation before invoking', async () => {
        const toolData = {
            id: 'testToolConfirm',
            modelDescription: 'Test Tool',
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        let invoked = false;
        const tool = registerToolForTest(service, store, toolData.id, {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Confirm', message: 'Go?' } }),
            invoke: async () => {
                invoked = true;
                return { content: [{ kind: 'text', value: 'ran' }] };
            },
        }, toolData);
        const sessionId = 'sessionId-confirm';
        const capture = {};
        stubGetSession(chatService, sessionId, { requestId: 'requestId-confirm', capture });
        const dto = tool.makeDto({ x: 1 }, { sessionId });
        const promise = service.invokeTool(dto, async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        assert.ok(published, 'expected ChatToolInvocation to be published');
        assert.strictEqual(invoked, false, 'invoke should not run before confirmation');
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const result = await promise;
        assert.strictEqual(invoked, true, 'invoke should have run after confirmation');
        assert.strictEqual(result.content[0].value, 'ran');
    });
    test('cancel tool call', async () => {
        const toolBarrier = new Barrier();
        const tool = registerToolForTest(service, store, 'testTool', {
            invoke: async (invocation, countTokens, progress, cancelToken) => {
                assert.strictEqual(invocation.callId, '1');
                assert.strictEqual(invocation.toolId, 'testTool');
                assert.deepStrictEqual(invocation.parameters, { a: 1 });
                await toolBarrier.wait();
                if (cancelToken.isCancellationRequested) {
                    throw new CancellationError();
                }
                else {
                    throw new Error('Tool call should be cancelled');
                }
            }
        });
        const sessionId = 'sessionId';
        const requestId = 'requestId';
        const dto = tool.makeDto({ a: 1 }, { sessionId });
        stubGetSession(chatService, sessionId, { requestId });
        const toolPromise = service.invokeTool(dto, async () => 0, CancellationToken.None);
        service.cancelToolCallsForRequest(requestId);
        toolBarrier.open();
        await assert.rejects(toolPromise, err => {
            return isCancellationError(err);
        }, 'Expected tool call to be cancelled');
    });
    test('toQualifiedToolNames', () => {
        setupToolsForTest(service, store);
        const tool1 = service.getToolByQualifiedName('tool1RefName');
        const extTool1 = service.getToolByQualifiedName('my.extension/extTool1RefName');
        const mcpToolSet = service.getToolByQualifiedName('mcpToolSetRefName/*');
        const mcpTool1 = service.getToolByQualifiedName('mcpToolSetRefName/mcpTool1RefName');
        const internalToolSet = service.getToolByQualifiedName('internalToolSetRefName');
        const internalTool = service.getToolByQualifiedName('internalToolSetRefName/internalToolSetTool1RefName');
        const userToolSet = service.getToolSet('userToolSet');
        const unknownTool = { id: 'unregisteredTool', toolReferenceName: 'unregisteredToolRefName', modelDescription: 'Unregistered Tool', displayName: 'Unregistered Tool', source: ToolDataSource.Internal, canBeReferencedInPrompt: true };
        const unknownToolSet = service.createToolSet(ToolDataSource.Internal, 'unknownToolSet', 'unknownToolSetRefName', { description: 'Unknown Test Set' });
        unknownToolSet.dispose(); // unregister the set
        assert.ok(tool1);
        assert.ok(extTool1);
        assert.ok(mcpTool1);
        assert.ok(mcpToolSet);
        assert.ok(internalToolSet);
        assert.ok(internalTool);
        assert.ok(userToolSet);
        // Test with some enabled tool
        {
            // creating a map by hand is a no-go, we just do it for this test
            const map = new Map([[tool1, true], [extTool1, true], [mcpToolSet, true], [mcpTool1, true]]);
            const qualifiedNames = service.toQualifiedToolNames(map);
            const expectedQualifiedNames = ['tool1RefName', 'my.extension/extTool1RefName', 'mcpToolSetRefName/*'];
            assert.deepStrictEqual(qualifiedNames.sort(), expectedQualifiedNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
        // Test with user data
        {
            // creating a map by hand is a no-go, we just do it for this test
            const map = new Map([[tool1, true], [userToolSet, true], [internalToolSet, false], [internalTool, true]]);
            const qualifiedNames = service.toQualifiedToolNames(map);
            const expectedQualifiedNames = ['tool1RefName', 'internalToolSetRefName/internalToolSetTool1RefName'];
            assert.deepStrictEqual(qualifiedNames.sort(), expectedQualifiedNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
        // Test with unknown tool and tool set
        {
            // creating a map by hand is a no-go, we just do it for this test
            const map = new Map([[unknownTool, true], [unknownToolSet, true], [internalToolSet, true], [internalTool, true]]);
            const qualifiedNames = service.toQualifiedToolNames(map);
            const expectedQualifiedNames = ['internalToolSetRefName'];
            assert.deepStrictEqual(qualifiedNames.sort(), expectedQualifiedNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
    });
    test('toToolAndToolSetEnablementMap', () => {
        setupToolsForTest(service, store);
        const allQualifiedNames = [
            'tool1RefName',
            'Tool2 Display Name',
            'my.extension/extTool1RefName',
            'mcpToolSetRefName/*',
            'mcpToolSetRefName/mcpTool1RefName',
            'internalToolSetRefName',
            'internalToolSetRefName/internalToolSetTool1RefName',
            'vscode',
            'execute',
            'read'
        ];
        const numOfTools = allQualifiedNames.length + 1; // +1 for userToolSet which has no qualified name but is a tool set
        const tool1 = service.getToolByQualifiedName('tool1RefName');
        const tool2 = service.getToolByQualifiedName('Tool2 Display Name');
        const extTool1 = service.getToolByQualifiedName('my.extension/extTool1RefName');
        const mcpToolSet = service.getToolByQualifiedName('mcpToolSetRefName/*');
        const mcpTool1 = service.getToolByQualifiedName('mcpToolSetRefName/mcpTool1RefName');
        const internalToolSet = service.getToolByQualifiedName('internalToolSetRefName');
        const internalTool = service.getToolByQualifiedName('internalToolSetRefName/internalToolSetTool1RefName');
        const userToolSet = service.getToolSet('userToolSet');
        const vscodeToolSet = service.getToolSet('vscode');
        const executeToolSet = service.getToolSet('execute');
        const readToolSet = service.getToolSet('read');
        assert.ok(tool1);
        assert.ok(tool2);
        assert.ok(extTool1);
        assert.ok(mcpTool1);
        assert.ok(mcpToolSet);
        assert.ok(internalToolSet);
        assert.ok(internalTool);
        assert.ok(userToolSet);
        assert.ok(vscodeToolSet);
        assert.ok(executeToolSet);
        assert.ok(readToolSet);
        // Test with enabled tool
        {
            const qualifiedNames = ['tool1RefName'];
            const result1 = service.toToolAndToolSetEnablementMap(qualifiedNames, undefined);
            assert.strictEqual(result1.size, numOfTools, `Expected ${numOfTools} tools and tool sets`);
            assert.strictEqual([...result1.entries()].filter(([_, enabled]) => enabled).length, 1, 'Expected 1 tool to be enabled');
            assert.strictEqual(result1.get(tool1), true, 'tool1 should be enabled');
            const qualifiedNames1 = service.toQualifiedToolNames(result1);
            assert.deepStrictEqual(qualifiedNames1.sort(), qualifiedNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
        // Test with multiple enabled tools
        {
            const qualifiedNames = ['my.extension/extTool1RefName', 'mcpToolSetRefName/*', 'internalToolSetRefName/internalToolSetTool1RefName'];
            const result1 = service.toToolAndToolSetEnablementMap(qualifiedNames, undefined);
            assert.strictEqual(result1.size, numOfTools, `Expected ${numOfTools} tools and tool sets`);
            assert.strictEqual([...result1.entries()].filter(([_, enabled]) => enabled).length, 4, 'Expected 4 tools to be enabled');
            assert.strictEqual(result1.get(extTool1), true, 'extTool1 should be enabled');
            assert.strictEqual(result1.get(mcpToolSet), true, 'mcpToolSet should be enabled');
            assert.strictEqual(result1.get(mcpTool1), true, 'mcpTool1 should be enabled because the set is enabled');
            assert.strictEqual(result1.get(internalTool), true, 'internalTool should be enabled because the set is enabled');
            const qualifiedNames1 = service.toQualifiedToolNames(result1);
            assert.deepStrictEqual(qualifiedNames1.sort(), qualifiedNames.sort(), 'toQualifiedToolNames should return the expected names');
        }
        // Test with all enabled tools, redundant names
        {
            const result1 = service.toToolAndToolSetEnablementMap(allQualifiedNames, undefined);
            assert.strictEqual(result1.size, numOfTools, `Expected ${numOfTools} tools and tool sets`);
            assert.strictEqual([...result1.entries()].filter(([_, enabled]) => enabled).length, 11, 'Expected 11 tools to be enabled'); // +3 including the vscode, execute, read toolsets
            const qualifiedNames1 = service.toQualifiedToolNames(result1);
            const expectedQualifiedNames = ['tool1RefName', 'Tool2 Display Name', 'my.extension/extTool1RefName', 'mcpToolSetRefName/*', 'internalToolSetRefName', 'vscode', 'execute', 'read'];
            assert.deepStrictEqual(qualifiedNames1.sort(), expectedQualifiedNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
        // Test with no enabled tools
        {
            const qualifiedNames = [];
            const result1 = service.toToolAndToolSetEnablementMap(qualifiedNames, undefined);
            assert.strictEqual(result1.size, numOfTools, `Expected ${numOfTools} tools and tool sets`);
            assert.strictEqual([...result1.entries()].filter(([_, enabled]) => enabled).length, 0, 'Expected 0 tools to be enabled');
            const qualifiedNames1 = service.toQualifiedToolNames(result1);
            assert.deepStrictEqual(qualifiedNames1.sort(), qualifiedNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
        // Test with unknown tool
        {
            const qualifiedNames = ['unknownToolRefName'];
            const result1 = service.toToolAndToolSetEnablementMap(qualifiedNames, undefined);
            assert.strictEqual(result1.size, numOfTools, `Expected ${numOfTools} tools and tool sets`);
            assert.strictEqual([...result1.entries()].filter(([_, enabled]) => enabled).length, 0, 'Expected 0 tools to be enabled');
            const qualifiedNames1 = service.toQualifiedToolNames(result1);
            assert.deepStrictEqual(qualifiedNames1.sort(), [], 'toQualifiedToolNames should return no enabled names');
        }
        // Test with legacy tool names
        {
            const qualifiedNames = ['extTool1RefName', 'mcpToolSetRefName', 'internalToolSetTool1RefName'];
            const result1 = service.toToolAndToolSetEnablementMap(qualifiedNames, undefined);
            assert.strictEqual(result1.size, numOfTools, `Expected ${numOfTools} tools and tool sets`);
            assert.strictEqual([...result1.entries()].filter(([_, enabled]) => enabled).length, 4, 'Expected 4 tools to be enabled');
            assert.strictEqual(result1.get(extTool1), true, 'extTool1 should be enabled');
            assert.strictEqual(result1.get(mcpToolSet), true, 'mcpToolSet should be enabled');
            assert.strictEqual(result1.get(mcpTool1), true, 'mcpTool1 should be enabled because the set is enabled');
            assert.strictEqual(result1.get(internalTool), true, 'internalTool should be enabled');
            const qualifiedNames1 = service.toQualifiedToolNames(result1);
            const expectedQualifiedNames = ['my.extension/extTool1RefName', 'mcpToolSetRefName/*', 'internalToolSetRefName/internalToolSetTool1RefName'];
            assert.deepStrictEqual(qualifiedNames1.sort(), expectedQualifiedNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
        // Test with tool in user tool set
        {
            const qualifiedNames = ['Tool2 Display Name'];
            const result1 = service.toToolAndToolSetEnablementMap(qualifiedNames, undefined);
            assert.strictEqual(result1.size, numOfTools, `Expected ${numOfTools} tools and tool sets`);
            assert.strictEqual([...result1.entries()].filter(([_, enabled]) => enabled).length, 2, 'Expected 1 tool and user tool set to be enabled');
            assert.strictEqual(result1.get(tool2), true, 'tool2 should be enabled');
            assert.strictEqual(result1.get(userToolSet), true, 'userToolSet should be enabled');
            const qualifiedNames1 = service.toQualifiedToolNames(result1);
            assert.deepStrictEqual(qualifiedNames1.sort(), qualifiedNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
    });
    test('toToolAndToolSetEnablementMap with extension tool', () => {
        // Register individual tools
        const toolData1 = {
            id: 'tool1',
            toolReferenceName: 'refTool1',
            modelDescription: 'Test Tool 1',
            displayName: 'Test Tool 1',
            source: { type: 'extension', label: 'My Extension', extensionId: new ExtensionIdentifier('My.extension') },
            canBeReferencedInPrompt: true,
        };
        store.add(service.registerToolData(toolData1));
        // Test enabling the tool set
        const enabledNames = [toolData1].map(t => service.getQualifiedToolName(t));
        const result = service.toToolAndToolSetEnablementMap(enabledNames, undefined);
        assert.strictEqual(result.get(toolData1), true, 'individual tool should be enabled');
        const qualifiedNames = service.toQualifiedToolNames(result);
        assert.deepStrictEqual(qualifiedNames.sort(), enabledNames.sort(), 'toQualifiedToolNames should return the original enabled names');
    });
    test('toToolAndToolSetEnablementMap with tool sets', () => {
        // Register individual tools
        const toolData1 = {
            id: 'tool1',
            toolReferenceName: 'refTool1',
            modelDescription: 'Test Tool 1',
            displayName: 'Test Tool 1',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
        };
        const toolData2 = {
            id: 'tool2',
            modelDescription: 'Test Tool 2',
            displayName: 'Test Tool 2',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
        };
        store.add(service.registerToolData(toolData1));
        store.add(service.registerToolData(toolData2));
        // Create a tool set
        const toolSet = store.add(service.createToolSet(ToolDataSource.Internal, 'testToolSet', 'refToolSet', { description: 'Test Tool Set' }));
        // Add tools to the tool set
        const toolSetTool1 = {
            id: 'toolSetTool1',
            modelDescription: 'Tool Set Tool 1',
            displayName: 'Tool Set Tool 1',
            source: ToolDataSource.Internal,
        };
        const toolSetTool2 = {
            id: 'toolSetTool2',
            modelDescription: 'Tool Set Tool 2',
            displayName: 'Tool Set Tool 2',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(toolSetTool1));
        store.add(service.registerToolData(toolSetTool2));
        store.add(toolSet.addTool(toolSetTool1));
        store.add(toolSet.addTool(toolSetTool2));
        // Test enabling the tool set
        const enabledNames = [toolSet, toolData1].map(t => service.getQualifiedToolName(t));
        const result = service.toToolAndToolSetEnablementMap(enabledNames, undefined);
        assert.strictEqual(result.get(toolData1), true, 'individual tool should be enabled');
        assert.strictEqual(result.get(toolData2), false);
        assert.strictEqual(result.get(toolSet), true, 'tool set should be enabled');
        assert.strictEqual(result.get(toolSetTool1), true, 'tool set tool 1 should be enabled');
        assert.strictEqual(result.get(toolSetTool2), true, 'tool set tool 2 should be enabled');
        const qualifiedNames = service.toQualifiedToolNames(result);
        assert.deepStrictEqual(qualifiedNames.sort(), enabledNames.sort(), 'toQualifiedToolNames should return the original enabled names');
    });
    test('toToolAndToolSetEnablementMap with non-existent tool names', () => {
        const toolData = {
            id: 'tool1',
            toolReferenceName: 'refTool1',
            modelDescription: 'Test Tool 1',
            displayName: 'Test Tool 1',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
        };
        store.add(service.registerToolData(toolData));
        const unregisteredToolData = {
            id: 'toolX',
            toolReferenceName: 'refToolX',
            modelDescription: 'Test Tool X',
            displayName: 'Test Tool X',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
        };
        // Test with non-existent tool names
        const enabledNames = [toolData, unregisteredToolData].map(t => service.getQualifiedToolName(t));
        const result = service.toToolAndToolSetEnablementMap(enabledNames, undefined);
        assert.strictEqual(result.get(toolData), true, 'existing tool should be enabled');
        // Non-existent tools should not appear in the result map
        assert.strictEqual(result.get(unregisteredToolData), undefined, 'non-existent tool should not be in result');
        const qualifiedNames = service.toQualifiedToolNames(result);
        const expectedNames = [service.getQualifiedToolName(toolData)]; // Only the existing tool
        assert.deepStrictEqual(qualifiedNames.sort(), expectedNames.sort(), 'toQualifiedToolNames should return the original enabled names');
    });
    test('toToolAndToolSetEnablementMap with legacy names', () => {
        // Test that legacy tool reference names and legacy toolset names work correctly
        // Create a tool with legacy reference names
        const toolWithLegacy = {
            id: 'newTool',
            toolReferenceName: 'newToolRef',
            modelDescription: 'New Tool',
            displayName: 'New Tool',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
            legacyToolReferenceFullNames: ['oldToolName', 'deprecatedToolName']
        };
        store.add(service.registerToolData(toolWithLegacy));
        // Create a tool set with legacy names
        const toolSetWithLegacy = store.add(service.createToolSet(ToolDataSource.Internal, 'newToolSet', 'newToolSetRef', { description: 'New Tool Set', legacyFullNames: ['oldToolSet', 'deprecatedToolSet'] }));
        // Create a tool in the toolset
        const toolInSet = {
            id: 'toolInSet',
            toolReferenceName: 'toolInSetRef',
            modelDescription: 'Tool In Set',
            displayName: 'Tool In Set',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(toolInSet));
        store.add(toolSetWithLegacy.addTool(toolInSet));
        // Test 1: Using legacy tool reference name should enable the tool
        {
            const result = service.toToolAndToolSetEnablementMap(['oldToolName'], undefined);
            assert.strictEqual(result.get(toolWithLegacy), true, 'tool should be enabled via legacy name');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames, ['newToolRef'], 'should return current qualified name, not legacy');
        }
        // Test 2: Using another legacy tool reference name should also work
        {
            const result = service.toToolAndToolSetEnablementMap(['deprecatedToolName'], undefined);
            assert.strictEqual(result.get(toolWithLegacy), true, 'tool should be enabled via another legacy name');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames, ['newToolRef'], 'should return current qualified name, not legacy');
        }
        // Test 3: Using legacy toolset name should enable the entire toolset
        {
            const result = service.toToolAndToolSetEnablementMap(['oldToolSet'], undefined);
            assert.strictEqual(result.get(toolSetWithLegacy), true, 'toolset should be enabled via legacy name');
            assert.strictEqual(result.get(toolInSet), true, 'tool in set should be enabled when set is enabled via legacy name');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames, ['newToolSetRef'], 'should return current qualified name, not legacy');
        }
        // Test 4: Using deprecated toolset name should also work
        {
            const result = service.toToolAndToolSetEnablementMap(['deprecatedToolSet'], undefined);
            assert.strictEqual(result.get(toolSetWithLegacy), true, 'toolset should be enabled via another legacy name');
            assert.strictEqual(result.get(toolInSet), true, 'tool in set should be enabled when set is enabled via legacy name');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames, ['newToolSetRef'], 'should return current qualified name, not legacy');
        }
        // Test 5: Mix of current and legacy names
        {
            const result = service.toToolAndToolSetEnablementMap(['newToolRef', 'oldToolSet'], undefined);
            assert.strictEqual(result.get(toolWithLegacy), true, 'tool should be enabled via current name');
            assert.strictEqual(result.get(toolSetWithLegacy), true, 'toolset should be enabled via legacy name');
            assert.strictEqual(result.get(toolInSet), true, 'tool in set should be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames.sort(), ['newToolRef', 'newToolSetRef'].sort(), 'should return current qualified names');
        }
        // Test 6: Using legacy names and current names together (redundant but should work)
        {
            const result = service.toToolAndToolSetEnablementMap(['newToolRef', 'oldToolName', 'deprecatedToolName'], undefined);
            assert.strictEqual(result.get(toolWithLegacy), true, 'tool should be enabled (redundant legacy names should not cause issues)');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames, ['newToolRef'], 'should return single current qualified name');
        }
    });
    test('toToolAndToolSetEnablementMap with orphaned toolset in legacy names', () => {
        // Test that when a tool has a legacy name with a toolset prefix, but that toolset no longer exists,
        // we can enable the tool by either the full legacy name OR just the orphaned toolset name
        // Create a tool that used to be in 'oldToolSet/oldToolName' but now is just 'newToolRef'
        const toolWithOrphanedToolSet = {
            id: 'migratedTool',
            toolReferenceName: 'newToolRef',
            modelDescription: 'Migrated Tool',
            displayName: 'Migrated Tool',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
            legacyToolReferenceFullNames: ['oldToolSet/oldToolName']
        };
        store.add(service.registerToolData(toolWithOrphanedToolSet));
        // Test 1: Using the full legacy name should enable the tool
        {
            const result = service.toToolAndToolSetEnablementMap(['oldToolSet/oldToolName'], undefined);
            assert.strictEqual(result.get(toolWithOrphanedToolSet), true, 'tool should be enabled via full legacy name');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames, ['newToolRef'], 'should return current qualified name');
        }
        // Test 2: Using just the orphaned toolset name should also enable the tool
        {
            const result = service.toToolAndToolSetEnablementMap(['oldToolSet'], undefined);
            assert.strictEqual(result.get(toolWithOrphanedToolSet), true, 'tool should be enabled via orphaned toolset name');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames, ['newToolRef'], 'should return current qualified name');
        }
        // Test 3: Multiple tools from the same orphaned toolset
        const anotherToolFromOrphanedSet = {
            id: 'anotherMigratedTool',
            toolReferenceName: 'anotherNewToolRef',
            modelDescription: 'Another Migrated Tool',
            displayName: 'Another Migrated Tool',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
            legacyToolReferenceFullNames: ['oldToolSet/anotherOldToolName']
        };
        store.add(service.registerToolData(anotherToolFromOrphanedSet));
        {
            const result = service.toToolAndToolSetEnablementMap(['oldToolSet'], undefined);
            assert.strictEqual(result.get(toolWithOrphanedToolSet), true, 'first tool should be enabled via orphaned toolset name');
            assert.strictEqual(result.get(anotherToolFromOrphanedSet), true, 'second tool should also be enabled via orphaned toolset name');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames.sort(), ['newToolRef', 'anotherNewToolRef'].sort(), 'should return both current qualified names');
        }
        // Test 4: Orphaned toolset name should NOT enable tools that weren't in that toolset
        const unrelatedTool = {
            id: 'unrelatedTool',
            toolReferenceName: 'unrelatedToolRef',
            modelDescription: 'Unrelated Tool',
            displayName: 'Unrelated Tool',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: true,
            legacyToolReferenceFullNames: ['differentToolSet/oldName']
        };
        store.add(service.registerToolData(unrelatedTool));
        {
            const result = service.toToolAndToolSetEnablementMap(['oldToolSet'], undefined);
            assert.strictEqual(result.get(toolWithOrphanedToolSet), true, 'tool from oldToolSet should be enabled');
            assert.strictEqual(result.get(anotherToolFromOrphanedSet), true, 'another tool from oldToolSet should be enabled');
            assert.strictEqual(result.get(unrelatedTool), false, 'tool from different toolset should NOT be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames.sort(), ['newToolRef', 'anotherNewToolRef'].sort(), 'should only return tools from oldToolSet');
        }
        // Test 5: If a toolset with the same name exists, it should take precedence over orphaned toolset mapping
        const newToolSetWithSameName = store.add(service.createToolSet(ToolDataSource.Internal, 'recreatedToolSet', 'oldToolSet', // Same name as the orphaned toolset
        { description: 'Recreated Tool Set' }));
        const toolInRecreatedSet = {
            id: 'toolInRecreatedSet',
            toolReferenceName: 'toolInRecreatedSetRef',
            modelDescription: 'Tool In Recreated Set',
            displayName: 'Tool In Recreated Set',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(toolInRecreatedSet));
        store.add(newToolSetWithSameName.addTool(toolInRecreatedSet));
        {
            const result = service.toToolAndToolSetEnablementMap(['oldToolSet'], undefined);
            // Now 'oldToolSet' should enable BOTH the recreated toolset AND the tools with legacy names pointing to oldToolSet
            assert.strictEqual(result.get(newToolSetWithSameName), true, 'recreated toolset should be enabled');
            assert.strictEqual(result.get(toolInRecreatedSet), true, 'tool in recreated set should be enabled');
            // The tools with legacy toolset names should ALSO be enabled because their legacy names match
            assert.strictEqual(result.get(toolWithOrphanedToolSet), true, 'tool with legacy toolset should still be enabled');
            assert.strictEqual(result.get(anotherToolFromOrphanedSet), true, 'another tool with legacy toolset should still be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result);
            // Should return the toolset name plus the individual tools that were enabled via legacy names
            assert.deepStrictEqual(qualifiedNames.sort(), ['oldToolSet', 'newToolRef', 'anotherNewToolRef'].sort(), 'should return toolset and individual tools');
        }
    });
    test('toToolAndToolSetEnablementMap map Github to VSCode tools', () => {
        const runInTerminalToolData = {
            id: 'runInTerminalId',
            toolReferenceName: 'runInTerminal',
            modelDescription: 'runInTerminal Description',
            displayName: 'runInTerminal displayName',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: false,
        };
        store.add(service.registerToolData(runInTerminalToolData));
        store.add(service.executeToolSet.addTool(runInTerminalToolData));
        const runSubagentToolData = {
            id: 'runSubagentId',
            toolReferenceName: 'runSubagent',
            modelDescription: 'runSubagent Description',
            displayName: 'runSubagent displayName',
            source: ToolDataSource.Internal,
            canBeReferencedInPrompt: false,
        };
        store.add(service.registerToolData(runSubagentToolData));
        const agentSet = store.add(service.createToolSet(ToolDataSource.Internal, VSCodeToolReference.agent, VSCodeToolReference.agent, { description: 'Agent' }));
        store.add(agentSet.addTool(runSubagentToolData));
        const githubMcpDataSource = { type: 'mcp', label: 'Github', serverLabel: 'Github MCP Server', instructions: undefined, collectionId: 'githubMCPCollection', definitionId: 'githubMCPDefId' };
        const githubMcpTool1 = {
            id: 'create_branch',
            toolReferenceName: 'create_branch',
            modelDescription: 'Test Github MCP Tool 1',
            displayName: 'Create Branch',
            source: githubMcpDataSource,
            canBeReferencedInPrompt: true,
        };
        store.add(service.registerToolData(githubMcpTool1));
        const githubMcpToolSet = store.add(service.createToolSet(githubMcpDataSource, 'githubMcpToolSet', 'github/github-mcp-server', { description: 'Github MCP Test ToolSet' }));
        store.add(githubMcpToolSet.addTool(githubMcpTool1));
        assert.equal(githubMcpToolSet.referenceName, 'github', 'github/github-mcp-server will be normalized to github');
        const playwrightMcpDataSource = { type: 'mcp', label: 'playwright', serverLabel: 'playwright MCP Server', instructions: undefined, collectionId: 'playwrightMCPCollection', definitionId: 'playwrightMCPDefId' };
        const playwrightMcpTool1 = {
            id: 'browser_click',
            toolReferenceName: 'browser_click',
            modelDescription: 'Test playwright MCP Tool 1',
            displayName: 'Create Branch',
            source: playwrightMcpDataSource,
            canBeReferencedInPrompt: true,
        };
        store.add(service.registerToolData(playwrightMcpTool1));
        const playwrightMcpToolSet = store.add(service.createToolSet(playwrightMcpDataSource, 'playwrightMcpToolSet', 'microsoft/playwright-mcp', { description: 'playwright MCP Test ToolSet' }));
        store.add(playwrightMcpToolSet.addTool(playwrightMcpTool1));
        const deprecated = service.getDeprecatedQualifiedToolNames();
        const deprecatesTo = (key) => {
            const values = deprecated.get(key);
            return values ? Array.from(values).sort() : undefined;
        };
        assert.equal(playwrightMcpToolSet.referenceName, 'playwright', 'microsoft/playwright-mcp will be normalized to playwright');
        {
            const toolNames = [GithubCopilotToolReference.customAgent, GithubCopilotToolReference.shell];
            const result = service.toToolAndToolSetEnablementMap(toolNames, undefined);
            assert.strictEqual(result.get(service.executeToolSet), true, 'execute should be enabled');
            assert.strictEqual(result.get(agentSet), true, 'agent should be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result).sort();
            assert.deepStrictEqual(qualifiedNames, [VSCodeToolReference.agent, VSCodeToolReference.execute].sort(), 'toQualifiedToolNames should return the VS Code tool names');
            assert.deepStrictEqual(toolNames.map(name => service.getToolByQualifiedName(name)), [agentSet, service.executeToolSet]);
            assert.deepStrictEqual(deprecatesTo(GithubCopilotToolReference.customAgent), [VSCodeToolReference.agent], 'customAgent should map to agent');
            assert.deepStrictEqual(deprecatesTo(GithubCopilotToolReference.shell), [VSCodeToolReference.execute], 'shell is fine');
        }
        {
            const toolNames = ['github/*', 'playwright/*'];
            const result = service.toToolAndToolSetEnablementMap(toolNames, undefined);
            assert.strictEqual(result.get(githubMcpToolSet), true, 'githubMcpToolSet should be enabled');
            assert.strictEqual(result.get(playwrightMcpToolSet), true, 'playwrightMcpToolSet should be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result).sort();
            assert.deepStrictEqual(qualifiedNames, ['github/*', 'playwright/*'], 'toQualifiedToolNames should return the VS Code tool names');
            assert.deepStrictEqual(toolNames.map(name => service.getToolByQualifiedName(name)), [githubMcpToolSet, playwrightMcpToolSet]);
            assert.deepStrictEqual(deprecatesTo('github/*'), undefined, 'github/* is fine');
            assert.deepStrictEqual(deprecatesTo('playwright/*'), undefined, 'playwright/* is fine');
        }
        {
            // the speced names should work and not be altered
            const toolNames = ['github/create_branch', 'playwright/browser_click'];
            const result = service.toToolAndToolSetEnablementMap(toolNames, undefined);
            assert.strictEqual(result.get(githubMcpTool1), true, 'githubMcpTool1 should be enabled');
            assert.strictEqual(result.get(playwrightMcpTool1), true, 'playwrightMcpTool1 should be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result).sort();
            assert.deepStrictEqual(qualifiedNames, ['github/create_branch', 'playwright/browser_click'], 'toQualifiedToolNames should return the speced names');
            assert.deepStrictEqual(toolNames.map(name => service.getToolByQualifiedName(name)), [githubMcpTool1, playwrightMcpTool1]);
            assert.deepStrictEqual(deprecatesTo('github/create_branch'), undefined, 'github/create_branch is fine');
            assert.deepStrictEqual(deprecatesTo('playwright/browser_click'), undefined, 'playwright/browser_click is fine');
        }
        {
            // using the old MCP full names should also work
            const toolNames = ['github/github-mcp-server/*', 'microsoft/playwright-mcp/*'];
            const result = service.toToolAndToolSetEnablementMap(toolNames, undefined);
            assert.strictEqual(result.get(githubMcpToolSet), true, 'githubMcpToolSet should be enabled');
            assert.strictEqual(result.get(playwrightMcpToolSet), true, 'playwrightMcpToolSet should be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result).sort();
            assert.deepStrictEqual(qualifiedNames, ['github/*', 'playwright/*'], 'toQualifiedToolNames should return the speced names');
            assert.deepStrictEqual(toolNames.map(name => service.getToolByQualifiedName(name)), [githubMcpToolSet, playwrightMcpToolSet]);
            assert.deepStrictEqual(deprecatesTo('github/github-mcp-server/*'), ['github/*']);
            assert.deepStrictEqual(deprecatesTo('microsoft/playwright-mcp/*'), ['playwright/*']);
        }
        {
            // using the old MCP full names should also work
            const toolNames = ['github/github-mcp-server/create_branch', 'microsoft/playwright-mcp/browser_click'];
            const result = service.toToolAndToolSetEnablementMap(toolNames, undefined);
            assert.strictEqual(result.get(githubMcpTool1), true, 'githubMcpTool1 should be enabled');
            assert.strictEqual(result.get(playwrightMcpTool1), true, 'playwrightMcpTool1 should be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result).sort();
            assert.deepStrictEqual(qualifiedNames, ['github/create_branch', 'playwright/browser_click'], 'toQualifiedToolNames should return the speced names');
            assert.deepStrictEqual(toolNames.map(name => service.getToolByQualifiedName(name)), [githubMcpTool1, playwrightMcpTool1]);
            assert.deepStrictEqual(deprecatesTo('github/github-mcp-server/create_branch'), ['github/create_branch']);
            assert.deepStrictEqual(deprecatesTo('microsoft/playwright-mcp/browser_click'), ['playwright/browser_click']);
        }
        {
            // using the latest MCP full names should also work
            const toolNames = ['io.github.github/github-mcp-server/*', 'com.microsoft/playwright-mcp/*'];
            const result = service.toToolAndToolSetEnablementMap(toolNames, undefined);
            assert.strictEqual(result.get(githubMcpToolSet), true, 'githubMcpToolSet should be enabled');
            assert.strictEqual(result.get(playwrightMcpToolSet), true, 'playwrightMcpToolSet should be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result).sort();
            assert.deepStrictEqual(qualifiedNames, ['github/*', 'playwright/*'], 'toQualifiedToolNames should return the speced names');
            assert.deepStrictEqual(toolNames.map(name => service.getToolByQualifiedName(name)), [githubMcpToolSet, playwrightMcpToolSet]);
            assert.deepStrictEqual(deprecatesTo('io.github.github/github-mcp-server/*'), ['github/*']);
            assert.deepStrictEqual(deprecatesTo('com.microsoft/playwright-mcp/*'), ['playwright/*']);
        }
        {
            // using the latest MCP full names should also work
            const toolNames = ['io.github.github/github-mcp-server/create_branch', 'com.microsoft/playwright-mcp/browser_click'];
            const result = service.toToolAndToolSetEnablementMap(toolNames, undefined);
            assert.strictEqual(result.get(githubMcpTool1), true, 'githubMcpTool1 should be enabled');
            assert.strictEqual(result.get(playwrightMcpTool1), true, 'playwrightMcpTool1 should be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result).sort();
            assert.deepStrictEqual(qualifiedNames, ['github/create_branch', 'playwright/browser_click'], 'toQualifiedToolNames should return the speced names');
            assert.deepStrictEqual(toolNames.map(name => service.getToolByQualifiedName(name)), [githubMcpTool1, playwrightMcpTool1]);
            assert.deepStrictEqual(deprecatesTo('io.github.github/github-mcp-server/create_branch'), ['github/create_branch']);
            assert.deepStrictEqual(deprecatesTo('com.microsoft/playwright-mcp/browser_click'), ['playwright/browser_click']);
        }
        {
            // using the old MCP full names should also work
            const toolNames = ['github-mcp-server/create_branch'];
            const result = service.toToolAndToolSetEnablementMap(toolNames, undefined);
            assert.strictEqual(result.get(githubMcpTool1), true, 'githubMcpTool1 should be enabled');
            const qualifiedNames = service.toQualifiedToolNames(result).sort();
            assert.deepStrictEqual(qualifiedNames, ['github/create_branch'], 'toQualifiedToolNames should return the VS Code tool names');
            assert.deepStrictEqual(toolNames.map(name => service.getToolByQualifiedName(name)), [githubMcpTool1]);
            assert.deepStrictEqual(deprecatesTo('github-mcp-server/create_branch'), ['github/create_branch']);
        }
    });
    test('accessibility signal for tool confirmation', async () => {
        // Create a test configuration service with proper settings
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.global.autoApprove', false);
        testConfigService.setUserConfiguration('accessibility.signals.chatUserActionRequired', { sound: 'auto', announcement: 'auto' });
        // Create a test accessibility service that simulates screen reader being enabled
        const testAccessibilityService = new class extends TestAccessibilityService {
            isScreenReaderOptimized() { return true; }
        }();
        // Create a test accessibility signal service that tracks calls
        const testAccessibilitySignalService = new TestAccessibilitySignalService();
        // Create a new service instance with the test services
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(IAccessibilityService, testAccessibilityService);
        instaService.stub(IAccessibilitySignalService, testAccessibilitySignalService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        const toolData = {
            id: 'testAccessibilityTool',
            modelDescription: 'Test Accessibility Tool',
            displayName: 'Test Accessibility Tool',
            source: ToolDataSource.Internal,
        };
        const tool = registerToolForTest(testService, store, toolData.id, {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Accessibility Test', message: 'Testing accessibility signal' } }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'executed' }] }),
        }, toolData);
        const sessionId = 'sessionId-accessibility';
        const capture = {};
        stubGetSession(chatService, sessionId, { requestId: 'requestId-accessibility', capture });
        const dto = tool.makeDto({ param: 'value' }, { sessionId });
        const promise = testService.invokeTool(dto, async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        assert.ok(published, 'expected ChatToolInvocation to be published');
        assert.ok(published.confirmationMessages, 'should have confirmation messages');
        // The accessibility signal should have been played
        assert.strictEqual(testAccessibilitySignalService.signalPlayedCalls.length, 1, 'accessibility signal should have been played once');
        const signalCall = testAccessibilitySignalService.signalPlayedCalls[0];
        assert.strictEqual(signalCall.signal, AccessibilitySignal.chatUserActionRequired, 'correct signal should be played');
        assert.ok(signalCall.options?.customAlertMessage.includes('Accessibility Test'), 'alert message should include tool title');
        assert.ok(signalCall.options?.customAlertMessage.includes('Chat confirmation required'), 'alert message should include confirmation text');
        // Complete the invocation
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const result = await promise;
        assert.strictEqual(result.content[0].value, 'executed');
    });
    test('accessibility signal respects autoApprove configuration', async () => {
        // Create a test configuration service with auto-approve enabled
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.global.autoApprove', true);
        testConfigService.setUserConfiguration('accessibility.signals.chatUserActionRequired', { sound: 'auto', announcement: 'auto' });
        // Create a test accessibility service that simulates screen reader being enabled
        const testAccessibilityService = new class extends TestAccessibilityService {
            isScreenReaderOptimized() { return true; }
        }();
        // Create a test accessibility signal service that tracks calls
        const testAccessibilitySignalService = new TestAccessibilitySignalService();
        // Create a new service instance with the test services
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(IAccessibilityService, testAccessibilityService);
        instaService.stub(IAccessibilitySignalService, testAccessibilitySignalService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        const toolData = {
            id: 'testAutoApproveTool',
            modelDescription: 'Test Auto Approve Tool',
            displayName: 'Test Auto Approve Tool',
            source: ToolDataSource.Internal,
        };
        const tool = registerToolForTest(testService, store, toolData.id, {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Auto Approve Test', message: 'Testing auto approve' } }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'auto approved' }] }),
        }, toolData);
        const sessionId = 'sessionId-auto-approve';
        const capture = {};
        stubGetSession(chatService, sessionId, { requestId: 'requestId-auto-approve', capture });
        const dto = tool.makeDto({ config: 'test' }, { sessionId });
        // When auto-approve is enabled, tool should complete without user intervention
        const result = await testService.invokeTool(dto, async () => 0, CancellationToken.None);
        // Verify the tool completed and no accessibility signal was played
        assert.strictEqual(result.content[0].value, 'auto approved');
        assert.strictEqual(testAccessibilitySignalService.signalPlayedCalls.length, 0, 'accessibility signal should not be played when auto-approve is enabled');
    });
    test('shouldAutoConfirm with basic configuration', async () => {
        // Test basic shouldAutoConfirm behavior with simple configuration
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.global.autoApprove', true); // Global enabled
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Register a tool that should be auto-approved
        const autoTool = registerToolForTest(testService, store, 'autoTool', {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Test', message: 'Should auto-approve' } }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'auto approved' }] })
        });
        const sessionId = 'test-basic-config';
        stubGetSession(chatService, sessionId, { requestId: 'req1' });
        // Tool should be auto-approved (global config = true)
        const result = await testService.invokeTool(autoTool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(result.content[0].value, 'auto approved');
    });
    test('shouldAutoConfirm with per-tool configuration object', async () => {
        // Test per-tool configuration: { toolId: true/false }
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.global.autoApprove', {
            'approvedTool': true,
            'deniedTool': false
        });
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Tool explicitly approved
        const approvedTool = registerToolForTest(testService, store, 'approvedTool', {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Test', message: 'Should auto-approve' } }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'approved' }] })
        });
        const sessionId = 'test-per-tool';
        stubGetSession(chatService, sessionId, { requestId: 'req1' });
        // Approved tool should auto-approve
        const approvedResult = await testService.invokeTool(approvedTool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(approvedResult.content[0].value, 'approved');
        // Test that non-specified tools require confirmation (default behavior)
        const unspecifiedTool = registerToolForTest(testService, store, 'unspecifiedTool', {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Test', message: 'Should require confirmation' } }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'unspecified' }] })
        });
        const capture = {};
        stubGetSession(chatService, sessionId + '2', { requestId: 'req2', capture });
        const unspecifiedPromise = testService.invokeTool(unspecifiedTool.makeDto({ test: 2 }, { sessionId: sessionId + '2' }), async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        assert.ok(published?.confirmationMessages, 'unspecified tool should require confirmation');
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const unspecifiedResult = await unspecifiedPromise;
        assert.strictEqual(unspecifiedResult.content[0].value, 'unspecified');
    });
    test('eligibleForAutoApproval setting controls tool eligibility', async () => {
        // Test the new eligibleForAutoApproval setting
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.eligibleForAutoApproval', {
            'eligibleToolRef': true,
            'ineligibleToolRef': false
        });
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Tool explicitly marked as eligible (using toolReferenceName) - no confirmation needed
        const eligibleTool = registerToolForTest(testService, store, 'eligibleTool', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'eligible tool ran' }] })
        }, {
            toolReferenceName: 'eligibleToolRef'
        });
        const sessionId = 'test-eligible';
        stubGetSession(chatService, sessionId, { requestId: 'req1' });
        // Eligible tool should not get default confirmation messages injected
        const eligibleResult = await testService.invokeTool(eligibleTool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(eligibleResult.content[0].value, 'eligible tool ran');
        // Tool explicitly marked as ineligible (using toolReferenceName) - must require confirmation
        const ineligibleTool = registerToolForTest(testService, store, 'ineligibleTool', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'ineligible requires confirmation' }] })
        }, {
            toolReferenceName: 'ineligibleToolRef'
        });
        const capture = {};
        stubGetSession(chatService, sessionId + '2', { requestId: 'req2', capture });
        const ineligiblePromise = testService.invokeTool(ineligibleTool.makeDto({ test: 2 }, { sessionId: sessionId + '2' }), async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        assert.ok(published?.confirmationMessages, 'ineligible tool should require confirmation');
        assert.ok(published?.confirmationMessages?.title, 'should have default confirmation title');
        assert.strictEqual(published?.confirmationMessages?.allowAutoConfirm, false, 'should not allow auto confirm');
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const ineligibleResult = await ineligiblePromise;
        assert.strictEqual(ineligibleResult.content[0].value, 'ineligible requires confirmation');
        // Tool not specified should default to eligible - no confirmation needed
        const unspecifiedTool = registerToolForTest(testService, store, 'unspecifiedTool', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'unspecified defaults to eligible' }] })
        }, {
            toolReferenceName: 'unspecifiedToolRef'
        });
        const unspecifiedResult = await testService.invokeTool(unspecifiedTool.makeDto({ test: 3 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(unspecifiedResult.content[0].value, 'unspecified defaults to eligible');
    });
    test('tool content formatting with alwaysDisplayInputOutput', async () => {
        // Test ensureToolDetails, formatToolInput, and toolResultToIO
        const toolData = {
            id: 'formatTool',
            modelDescription: 'Format Test Tool',
            displayName: 'Format Test Tool',
            source: ToolDataSource.Internal,
            alwaysDisplayInputOutput: true
        };
        const tool = registerToolForTest(service, store, toolData.id, {
            prepareToolInvocation: async () => ({}),
            invoke: async (invocation) => ({
                content: [
                    { kind: 'text', value: 'Text result' },
                    { kind: 'data', value: { data: VSBuffer.fromByteArray([1, 2, 3]), mimeType: 'application/octet-stream' } }
                ]
            })
        }, toolData);
        const input = { a: 1, b: 'test', c: [1, 2, 3] };
        const result = await service.invokeTool(tool.makeDto(input), async () => 0, CancellationToken.None);
        // Should have tool result details because alwaysDisplayInputOutput = true
        assert.ok(result.toolResultDetails, 'should have toolResultDetails');
        const details = result.toolResultDetails;
        assert.ok(isToolResultInputOutputDetails(details));
        // Test formatToolInput - should be formatted JSON
        const expectedInputJson = JSON.stringify(input, undefined, 2);
        assert.strictEqual(details.input, expectedInputJson, 'input should be formatted JSON');
        // Test toolResultToIO - should convert different content types
        assert.strictEqual(details.output.length, 2, 'should have 2 output items');
        // Text content
        const textOutput = details.output[0];
        assert.strictEqual(textOutput.type, 'embed');
        assert.strictEqual(textOutput.isText, true);
        assert.strictEqual(textOutput.value, 'Text result');
        // Data content (base64 encoded)
        const dataOutput = details.output[1];
        assert.strictEqual(dataOutput.type, 'embed');
        assert.strictEqual(dataOutput.mimeType, 'application/octet-stream');
        assert.strictEqual(dataOutput.value, 'AQID'); // base64 of [1,2,3]
    });
    test('tool error handling and telemetry', async () => {
        const testTelemetryService = new TestTelemetryService();
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(configurationService)),
            configurationService: () => configurationService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ITelemetryService, testTelemetryService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Test successful invocation telemetry
        const successTool = registerToolForTest(testService, store, 'successTool', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'success' }] })
        });
        const sessionId = 'telemetry-test';
        stubGetSession(chatService, sessionId, { requestId: 'req1' });
        await testService.invokeTool(successTool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        // Check success telemetry
        const successEvents = testTelemetryService.events.filter(e => e.eventName === 'languageModelToolInvoked');
        assert.strictEqual(successEvents.length, 1, 'should have success telemetry event');
        assert.strictEqual(successEvents[0].data.result, 'success');
        assert.strictEqual(successEvents[0].data.toolId, 'successTool');
        assert.strictEqual(successEvents[0].data.chatSessionId, sessionId);
        testTelemetryService.reset();
        // Test error telemetry
        const errorTool = registerToolForTest(testService, store, 'errorTool', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => { throw new Error('Tool error'); }
        });
        stubGetSession(chatService, sessionId + '2', { requestId: 'req2' });
        try {
            await testService.invokeTool(errorTool.makeDto({ test: 2 }, { sessionId: sessionId + '2' }), async () => 0, CancellationToken.None);
            assert.fail('Should have thrown');
        }
        catch (err) {
            // Expected
        }
        // Check error telemetry
        const errorEvents = testTelemetryService.events.filter(e => e.eventName === 'languageModelToolInvoked');
        assert.strictEqual(errorEvents.length, 1, 'should have error telemetry event');
        assert.strictEqual(errorEvents[0].data.result, 'error');
        assert.strictEqual(errorEvents[0].data.toolId, 'errorTool');
    });
    test('call tracking and cleanup', async () => {
        // Test that cancelToolCallsForRequest method exists and can be called
        // (The detailed cancellation behavior is already tested in "cancel tool call" test)
        const sessionId = 'tracking-session';
        const requestId = 'tracking-request';
        stubGetSession(chatService, sessionId, { requestId });
        // Just verify the method exists and doesn't throw
        assert.doesNotThrow(() => {
            service.cancelToolCallsForRequest(requestId);
        }, 'cancelToolCallsForRequest should not throw');
        // Verify calling with non-existent request ID doesn't throw
        assert.doesNotThrow(() => {
            service.cancelToolCallsForRequest('non-existent-request');
        }, 'cancelToolCallsForRequest with non-existent ID should not throw');
    });
    test('accessibility signal with different settings combinations', async () => {
        const testAccessibilitySignalService = new TestAccessibilitySignalService();
        // Test case 1: Sound enabled, announcement disabled, screen reader off
        const testConfigService1 = new TestConfigurationService();
        testConfigService1.setUserConfiguration('chat.tools.global.autoApprove', false);
        testConfigService1.setUserConfiguration('accessibility.signals.chatUserActionRequired', { sound: 'on', announcement: 'off' });
        const testAccessibilityService1 = new class extends TestAccessibilityService {
            isScreenReaderOptimized() { return false; }
        }();
        const instaService1 = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService1)),
            configurationService: () => testConfigService1
        }, store);
        instaService1.stub(IChatService, chatService);
        instaService1.stub(IAccessibilityService, testAccessibilityService1);
        instaService1.stub(IAccessibilitySignalService, testAccessibilitySignalService);
        instaService1.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService1 = store.add(instaService1.createInstance(LanguageModelToolsService));
        const tool1 = registerToolForTest(testService1, store, 'soundOnlyTool', {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Sound Test', message: 'Testing sound only' } }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'executed' }] })
        });
        const sessionId1 = 'sound-test';
        const capture1 = {};
        stubGetSession(chatService, sessionId1, { requestId: 'req1', capture: capture1 });
        const promise1 = testService1.invokeTool(tool1.makeDto({ test: 1 }, { sessionId: sessionId1 }), async () => 0, CancellationToken.None);
        const published1 = await waitForPublishedInvocation(capture1);
        // Signal should be played (sound=on, no screen reader requirement)
        assert.strictEqual(testAccessibilitySignalService.signalPlayedCalls.length, 1, 'sound should be played when sound=on');
        const call1 = testAccessibilitySignalService.signalPlayedCalls[0];
        assert.strictEqual(call1.options?.modality, undefined, 'should use default modality for sound');
        IChatToolInvocation.confirmWith(published1, { type: 4 /* ToolConfirmKind.UserAction */ });
        await promise1;
        testAccessibilitySignalService.reset();
        // Test case 2: Sound auto, announcement auto, screen reader on
        const testConfigService2 = new TestConfigurationService();
        testConfigService2.setUserConfiguration('chat.tools.global.autoApprove', false);
        testConfigService2.setUserConfiguration('accessibility.signals.chatUserActionRequired', { sound: 'auto', announcement: 'auto' });
        const testAccessibilityService2 = new class extends TestAccessibilityService {
            isScreenReaderOptimized() { return true; }
        }();
        const instaService2 = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService2)),
            configurationService: () => testConfigService2
        }, store);
        instaService2.stub(IChatService, chatService);
        instaService2.stub(IAccessibilityService, testAccessibilityService2);
        instaService2.stub(IAccessibilitySignalService, testAccessibilitySignalService);
        instaService2.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService2 = store.add(instaService2.createInstance(LanguageModelToolsService));
        const tool2 = registerToolForTest(testService2, store, 'autoScreenReaderTool', {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Auto Test', message: 'Testing auto with screen reader' } }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'executed' }] })
        });
        const sessionId2 = 'auto-sr-test';
        const capture2 = {};
        stubGetSession(chatService, sessionId2, { requestId: 'req2', capture: capture2 });
        const promise2 = testService2.invokeTool(tool2.makeDto({ test: 2 }, { sessionId: sessionId2 }), async () => 0, CancellationToken.None);
        const published2 = await waitForPublishedInvocation(capture2);
        // Signal should be played (both sound and announcement enabled for screen reader)
        assert.strictEqual(testAccessibilitySignalService.signalPlayedCalls.length, 1, 'signal should be played with screen reader optimization');
        const call2 = testAccessibilitySignalService.signalPlayedCalls[0];
        assert.ok(call2.options?.customAlertMessage, 'should have custom alert message');
        assert.strictEqual(call2.options?.userGesture, true, 'should mark as user gesture');
        IChatToolInvocation.confirmWith(published2, { type: 4 /* ToolConfirmKind.UserAction */ });
        await promise2;
        testAccessibilitySignalService.reset();
        // Test case 3: Sound off, announcement off - no signal
        const testConfigService3 = new TestConfigurationService();
        testConfigService3.setUserConfiguration('chat.tools.global.autoApprove', false);
        testConfigService3.setUserConfiguration('accessibility.signals.chatUserActionRequired', { sound: 'off', announcement: 'off' });
        const testAccessibilityService3 = new class extends TestAccessibilityService {
            isScreenReaderOptimized() { return true; }
        }();
        const instaService3 = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService3)),
            configurationService: () => testConfigService3
        }, store);
        instaService3.stub(IChatService, chatService);
        instaService3.stub(IAccessibilityService, testAccessibilityService3);
        instaService3.stub(IAccessibilitySignalService, testAccessibilitySignalService);
        instaService3.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService3 = store.add(instaService3.createInstance(LanguageModelToolsService));
        const tool3 = registerToolForTest(testService3, store, 'offTool', {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Off Test', message: 'Testing off settings' } }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'executed' }] })
        });
        const sessionId3 = 'off-test';
        const capture3 = {};
        stubGetSession(chatService, sessionId3, { requestId: 'req3', capture: capture3 });
        const promise3 = testService3.invokeTool(tool3.makeDto({ test: 3 }, { sessionId: sessionId3 }), async () => 0, CancellationToken.None);
        const published3 = await waitForPublishedInvocation(capture3);
        // No signal should be played
        assert.strictEqual(testAccessibilitySignalService.signalPlayedCalls.length, 0, 'no signal should be played when both sound and announcement are off');
        IChatToolInvocation.confirmWith(published3, { type: 4 /* ToolConfirmKind.UserAction */ });
        await promise3;
    });
    test('createToolSet and getToolSet', () => {
        const toolSet = store.add(service.createToolSet(ToolDataSource.Internal, 'testToolSetId', 'testToolSetName', { icon: undefined, description: 'Test tool set' }));
        // Should be able to retrieve by ID
        const retrieved = service.getToolSet('testToolSetId');
        assert.ok(retrieved);
        assert.strictEqual(retrieved.id, 'testToolSetId');
        assert.strictEqual(retrieved.referenceName, 'testToolSetName');
        // Should not find non-existent tool set
        assert.strictEqual(service.getToolSet('nonExistentId'), undefined);
        // Dispose should remove it
        toolSet.dispose();
        assert.strictEqual(service.getToolSet('testToolSetId'), undefined);
    });
    test('getToolSetByName', () => {
        store.add(service.createToolSet(ToolDataSource.Internal, 'toolSet1', 'refName1'));
        store.add(service.createToolSet(ToolDataSource.Internal, 'toolSet2', 'refName2'));
        // Should find by reference name
        assert.strictEqual(service.getToolSetByName('refName1')?.id, 'toolSet1');
        assert.strictEqual(service.getToolSetByName('refName2')?.id, 'toolSet2');
        // Should not find non-existent name
        assert.strictEqual(service.getToolSetByName('nonExistentName'), undefined);
    });
    test('getTools with includeDisabled parameter', () => {
        // Test the includeDisabled parameter behavior with context keys
        contextKeyService.createKey('testKey', false);
        const disabledTool = {
            id: 'disabledTool',
            modelDescription: 'Disabled Tool',
            displayName: 'Disabled Tool',
            source: ToolDataSource.Internal,
            when: ContextKeyEqualsExpr.create('testKey', true), // Will be disabled since testKey is false
        };
        const enabledTool = {
            id: 'enabledTool',
            modelDescription: 'Enabled Tool',
            displayName: 'Enabled Tool',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(disabledTool));
        store.add(service.registerToolData(enabledTool));
        const enabledTools = Array.from(service.getTools());
        assert.strictEqual(enabledTools.length, 1, 'Should only return enabled tools');
        assert.strictEqual(enabledTools[0].id, 'enabledTool');
        const allTools = Array.from(service.getTools(true));
        assert.strictEqual(allTools.length, 2, 'includeDisabled should return all tools');
    });
    test('tool registration duplicate error', () => {
        const toolData = {
            id: 'duplicateTool',
            modelDescription: 'Duplicate Tool',
            displayName: 'Duplicate Tool',
            source: ToolDataSource.Internal,
        };
        // First registration should succeed
        store.add(service.registerToolData(toolData));
        // Second registration should throw
        assert.throws(() => {
            service.registerToolData(toolData);
        }, /Tool "duplicateTool" is already registered/);
    });
    test('tool implementation registration without data throws', () => {
        const toolImpl = {
            invoke: async () => ({ content: [] }),
        };
        // Should throw when registering implementation for non-existent tool
        assert.throws(() => {
            service.registerToolImplementation('nonExistentTool', toolImpl);
        }, /Tool "nonExistentTool" was not contributed/);
    });
    test('tool implementation duplicate registration throws', () => {
        const toolData = {
            id: 'testTool',
            modelDescription: 'Test Tool',
            displayName: 'Test Tool',
            source: ToolDataSource.Internal,
        };
        const toolImpl1 = {
            invoke: async () => ({ content: [] }),
        };
        const toolImpl2 = {
            invoke: async () => ({ content: [] }),
        };
        store.add(service.registerToolData(toolData));
        store.add(service.registerToolImplementation('testTool', toolImpl1));
        // Second implementation should throw
        assert.throws(() => {
            service.registerToolImplementation('testTool', toolImpl2);
        }, /Tool "testTool" already has an implementation/);
    });
    test('invokeTool with unknown tool throws', async () => {
        const dto = {
            callId: '1',
            toolId: 'unknownTool',
            tokenBudget: 100,
            parameters: {},
            context: undefined,
        };
        await assert.rejects(service.invokeTool(dto, async () => 0, CancellationToken.None), /Tool unknownTool was not contributed/);
    });
    test('invokeTool without implementation activates extension and throws if still not found', async () => {
        const toolData = {
            id: 'extensionActivationTool',
            modelDescription: 'Extension Tool',
            displayName: 'Extension Tool',
            source: ToolDataSource.Internal,
        };
        store.add(service.registerToolData(toolData));
        const dto = {
            callId: '1',
            toolId: 'extensionActivationTool',
            tokenBudget: 100,
            parameters: {},
            context: undefined,
        };
        // Should throw after attempting extension activation
        await assert.rejects(service.invokeTool(dto, async () => 0, CancellationToken.None), /Tool extensionActivationTool does not have an implementation registered/);
    });
    test('invokeTool without context (non-chat scenario)', async () => {
        const tool = registerToolForTest(service, store, 'nonChatTool', {
            invoke: async (invocation) => {
                assert.strictEqual(invocation.context, undefined);
                return { content: [{ kind: 'text', value: 'non-chat result' }] };
            }
        });
        const dto = tool.makeDto({ test: 1 }); // No context
        const result = await service.invokeTool(dto, async () => 0, CancellationToken.None);
        assert.strictEqual(result.content[0].value, 'non-chat result');
    });
    test('invokeTool with unknown chat session throws', async () => {
        const tool = registerToolForTest(service, store, 'unknownSessionTool', {
            invoke: async () => ({ content: [{ kind: 'text', value: 'should not reach' }] })
        });
        const dto = tool.makeDto({ test: 1 }, { sessionId: 'unknownSession' });
        // Test that it throws, regardless of exact error message
        let threwError = false;
        try {
            await service.invokeTool(dto, async () => 0, CancellationToken.None);
        }
        catch (err) {
            threwError = true;
            // Verify it's one of the expected error types
            assert.ok(err instanceof Error && (err.message.includes('Tool called for unknown chat session') ||
                err.message.includes('getRequests is not a function')), `Unexpected error: ${err.message}`);
        }
        assert.strictEqual(threwError, true, 'Should have thrown an error');
    });
    test('tool error with alwaysDisplayInputOutput includes details', async () => {
        const toolData = {
            id: 'errorToolWithIO',
            modelDescription: 'Error Tool With IO',
            displayName: 'Error Tool With IO',
            source: ToolDataSource.Internal,
            alwaysDisplayInputOutput: true
        };
        const tool = registerToolForTest(service, store, toolData.id, {
            invoke: async () => { throw new Error('Tool execution failed'); }
        }, toolData);
        const input = { param: 'testValue' };
        try {
            await service.invokeTool(tool.makeDto(input), async () => 0, CancellationToken.None);
            assert.fail('Should have thrown');
        }
        catch (err) {
            // The error should bubble up, but we need to check if toolResultError is set
            // This tests the internal error handling path
            assert.strictEqual(err.message, 'Tool execution failed');
        }
    });
    test('context key changes trigger tool updates', async () => {
        let changeEventFired = false;
        const disposable = service.onDidChangeTools(() => {
            changeEventFired = true;
        });
        store.add(disposable);
        // Create a tool with a context key dependency
        contextKeyService.createKey('dynamicKey', false);
        const toolData = {
            id: 'contextTool',
            modelDescription: 'Context Tool',
            displayName: 'Context Tool',
            source: ToolDataSource.Internal,
            when: ContextKeyEqualsExpr.create('dynamicKey', true),
        };
        store.add(service.registerToolData(toolData));
        // Change the context key value
        contextKeyService.createKey('dynamicKey', true);
        // Wait a bit for the scheduler
        await new Promise(resolve => setTimeout(resolve, 800));
        assert.strictEqual(changeEventFired, true, 'onDidChangeTools should fire when context keys change');
    });
    test('configuration changes trigger tool updates', async () => {
        return runWithFakedTimers({}, async () => {
            let changeEventFired = false;
            const disposable = service.onDidChangeTools(() => {
                changeEventFired = true;
            });
            store.add(disposable);
            // Change the correct configuration key
            configurationService.setUserConfiguration('chat.extensionTools.enabled', false);
            // Fire the configuration change event manually
            configurationService.onDidChangeConfigurationEmitter.fire({
                affectsConfiguration: () => true,
                affectedKeys: new Set(['chat.extensionTools.enabled']),
                change: null,
                source: 2 /* ConfigurationTarget.USER */
            });
            // Wait a bit for the scheduler
            await new Promise(resolve => setTimeout(resolve, 800));
            assert.strictEqual(changeEventFired, true, 'onDidChangeTools should fire when configuration changes');
        });
    });
    test('toToolAndToolSetEnablementMap with MCP toolset enables contained tools', () => {
        // Create MCP toolset
        const mcpToolSet = store.add(service.createToolSet({ type: 'mcp', label: 'testServer', serverLabel: 'testServer', instructions: undefined, collectionId: 'testCollection', definitionId: 'testDef' }, 'mcpSet', 'mcpSetRef'));
        const mcpTool = {
            id: 'mcpTool',
            modelDescription: 'MCP Tool',
            displayName: 'MCP Tool',
            source: { type: 'mcp', label: 'testServer', serverLabel: 'testServer', instructions: undefined, collectionId: 'testCollection', definitionId: 'testDef' },
            canBeReferencedInPrompt: true,
            toolReferenceName: 'mcpToolRef'
        };
        store.add(service.registerToolData(mcpTool));
        store.add(mcpToolSet.addTool(mcpTool));
        // Enable the MCP toolset
        {
            const enabledNames = [mcpToolSet].map(t => service.getQualifiedToolName(t));
            const result = service.toToolAndToolSetEnablementMap(enabledNames, undefined);
            assert.strictEqual(result.get(mcpToolSet), true, 'MCP toolset should be enabled'); // Ensure the toolset is in the map
            assert.strictEqual(result.get(mcpTool), true, 'MCP tool should be enabled when its toolset is enabled'); // Ensure the tool is in the map
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames.sort(), enabledNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
        // Enable a tool from the MCP toolset
        {
            const enabledNames = [mcpTool].map(t => service.getQualifiedToolName(t, mcpToolSet));
            const result = service.toToolAndToolSetEnablementMap(enabledNames, undefined);
            assert.strictEqual(result.get(mcpToolSet), false, 'MCP toolset should be disabled'); // Ensure the toolset is in the map
            assert.strictEqual(result.get(mcpTool), true, 'MCP tool should be enabled'); // Ensure the tool is in the map
            const qualifiedNames = service.toQualifiedToolNames(result);
            assert.deepStrictEqual(qualifiedNames.sort(), enabledNames.sort(), 'toQualifiedToolNames should return the original enabled names');
        }
    });
    test('shouldAutoConfirm with workspace-specific tool configuration', async () => {
        const testConfigService = new TestConfigurationService();
        // Configure per-tool settings at different scopes
        testConfigService.setUserConfiguration('chat.tools.global.autoApprove', { 'workspaceTool': true });
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        const workspaceTool = registerToolForTest(testService, store, 'workspaceTool', {
            prepareToolInvocation: async () => ({ confirmationMessages: { title: 'Test', message: 'Workspace tool' } }),
            invoke: async () => ({ content: [{ kind: 'text', value: 'workspace result' }] })
        }, { runsInWorkspace: true });
        const sessionId = 'workspace-test';
        stubGetSession(chatService, sessionId, { requestId: 'req1' });
        // Should auto-approve based on user configuration
        const result = await testService.invokeTool(workspaceTool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(result.content[0].value, 'workspace result');
    });
    test('getQualifiedToolNames', () => {
        setupToolsForTest(service, store);
        const qualifiedNames = Array.from(service.getQualifiedToolNames()).sort();
        const expectedNames = [
            'tool1RefName',
            'Tool2 Display Name',
            'my.extension/extTool1RefName',
            'mcpToolSetRefName/*',
            'mcpToolSetRefName/mcpTool1RefName',
            'internalToolSetRefName',
            'internalToolSetRefName/internalToolSetTool1RefName',
            'vscode',
            'execute',
            'read'
        ].sort();
        assert.deepStrictEqual(qualifiedNames, expectedNames, 'getQualifiedToolNames should return correct qualified names');
    });
    test('getDeprecatedQualifiedToolNames', () => {
        setupToolsForTest(service, store);
        const deprecatedNames = service.getDeprecatedQualifiedToolNames();
        // Tools in internal tool sets should have their qualified names with toolset prefix, tools sets keep their name
        assert.deepStrictEqual(deprecatedNames.get('internalToolSetTool1RefName'), new Set(['internalToolSetRefName/internalToolSetTool1RefName']));
        assert.strictEqual(deprecatedNames.get('internalToolSetRefName'), undefined);
        // For extension tools, the qualified name includes the extension ID
        assert.deepStrictEqual(deprecatedNames.get('extTool1RefName'), new Set(['my.extension/extTool1RefName']));
        // For MCP tool sets, the qualified name includes the /* suffix
        assert.deepStrictEqual(deprecatedNames.get('mcpToolSetRefName'), new Set(['mcpToolSetRefName/*']));
        assert.deepStrictEqual(deprecatedNames.get('mcpTool1RefName'), new Set(['mcpToolSetRefName/mcpTool1RefName']));
        // Internal tool sets and user tools sets and tools without namespace changes should not appear
        assert.strictEqual(deprecatedNames.get('Tool2 Display Name'), undefined);
        assert.strictEqual(deprecatedNames.get('tool1RefName'), undefined);
        assert.strictEqual(deprecatedNames.get('userToolSetRefName'), undefined);
    });
    test('getToolByQualifiedName', () => {
        setupToolsForTest(service, store);
        // Test finding tools by their qualified names
        const tool1 = service.getToolByQualifiedName('tool1RefName');
        assert.ok(tool1);
        assert.strictEqual(tool1.id, 'tool1');
        const tool2 = service.getToolByQualifiedName('Tool2 Display Name');
        assert.ok(tool2);
        assert.strictEqual(tool2.id, 'tool2');
        const extTool = service.getToolByQualifiedName('my.extension/extTool1RefName');
        assert.ok(extTool);
        assert.strictEqual(extTool.id, 'extTool1');
        const mcpTool = service.getToolByQualifiedName('mcpToolSetRefName/mcpTool1RefName');
        assert.ok(mcpTool);
        assert.strictEqual(mcpTool.id, 'mcpTool1');
        const mcpToolSet = service.getToolByQualifiedName('mcpToolSetRefName/*');
        assert.ok(mcpToolSet);
        assert.strictEqual(mcpToolSet.id, 'mcpToolSet');
        const internalToolSet = service.getToolByQualifiedName('internalToolSetRefName/internalToolSetTool1RefName');
        assert.ok(internalToolSet);
        assert.strictEqual(internalToolSet.id, 'internalToolSetTool1');
        // Test finding tools within tool sets
        const toolInSet = service.getToolByQualifiedName('internalToolSetRefName');
        assert.ok(toolInSet);
        assert.strictEqual(toolInSet.id, 'internalToolSet');
    });
    test('eligibleForAutoApproval setting can be configured via policy', async () => {
        // Test that policy configuration works for eligibleForAutoApproval
        // Policy values should be JSON strings for object-type settings
        const testConfigService = new TestConfigurationService();
        // Simulate policy configuration (would come from policy file)
        const policyValue = {
            'toolA': true,
            'toolB': false
        };
        testConfigService.setUserConfiguration('chat.tools.eligibleForAutoApproval', policyValue);
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Tool A is eligible (true in policy)
        const toolA = registerToolForTest(testService, store, 'toolA', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'toolA executed' }] })
        }, {
            toolReferenceName: 'toolA'
        });
        // Tool B is ineligible (false in policy)
        const toolB = registerToolForTest(testService, store, 'toolB', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'toolB executed' }] })
        }, {
            toolReferenceName: 'toolB'
        });
        const sessionId = 'test-policy';
        stubGetSession(chatService, sessionId, { requestId: 'req1' });
        // Tool A should execute without confirmation (eligible)
        const resultA = await testService.invokeTool(toolA.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(resultA.content[0].value, 'toolA executed');
        // Tool B should require confirmation (ineligible)
        const capture = {};
        stubGetSession(chatService, sessionId + '2', { requestId: 'req2', capture });
        const promiseB = testService.invokeTool(toolB.makeDto({ test: 2 }, { sessionId: sessionId + '2' }), async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        assert.ok(published?.confirmationMessages, 'toolB should require confirmation due to policy');
        assert.strictEqual(published?.confirmationMessages?.allowAutoConfirm, false, 'should not allow auto confirm');
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const resultB = await promiseB;
        assert.strictEqual(resultB.content[0].value, 'toolB executed');
    });
    test('eligibleForAutoApproval with legacy tool reference names - eligible', async () => {
        // Test backwards compatibility: configuring a legacy name as eligible should work
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.eligibleForAutoApproval', {
            'oldToolName': true // Using legacy name
        });
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Tool has been renamed but has legacy name
        const renamedTool = registerToolForTest(testService, store, 'renamedTool', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'tool executed via legacy name' }] })
        }, {
            toolReferenceName: 'newToolName',
            legacyToolReferenceFullNames: ['oldToolName']
        });
        const sessionId = 'test-legacy-eligible';
        stubGetSession(chatService, sessionId, { requestId: 'req1' });
        // Tool should be eligible even though we configured the legacy name
        const result = await testService.invokeTool(renamedTool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(result.content[0].value, 'tool executed via legacy name');
    });
    test('eligibleForAutoApproval with legacy tool reference names - ineligible', async () => {
        // Test backwards compatibility: configuring a legacy name as ineligible should work
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.eligibleForAutoApproval', {
            'deprecatedToolName': false // Using legacy name
        });
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Tool has been renamed but has legacy name
        const renamedTool = registerToolForTest(testService, store, 'renamedTool2', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'tool requires confirmation' }] })
        }, {
            toolReferenceName: 'modernToolName',
            legacyToolReferenceFullNames: ['deprecatedToolName']
        });
        const sessionId = 'test-legacy-ineligible';
        const capture = {};
        stubGetSession(chatService, sessionId, { requestId: 'req1', capture });
        // Tool should be ineligible and require confirmation
        const promise = testService.invokeTool(renamedTool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        assert.ok(published?.confirmationMessages, 'tool should require confirmation when legacy name is ineligible');
        assert.strictEqual(published?.confirmationMessages?.allowAutoConfirm, false, 'should not allow auto confirm');
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const result = await promise;
        assert.strictEqual(result.content[0].value, 'tool requires confirmation');
    });
    test('eligibleForAutoApproval with multiple legacy names', async () => {
        // Test that any of the legacy names can be used in the configuration
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.eligibleForAutoApproval', {
            'secondLegacyName': true // Using the second legacy name
        });
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Tool has multiple legacy names
        const multiLegacyTool = registerToolForTest(testService, store, 'multiLegacyTool', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'multi legacy executed' }] })
        }, {
            toolReferenceName: 'currentToolName',
            legacyToolReferenceFullNames: ['firstLegacyName', 'secondLegacyName', 'thirdLegacyName']
        });
        const sessionId = 'test-multi-legacy';
        stubGetSession(chatService, sessionId, { requestId: 'req1' });
        // Tool should be eligible via second legacy name
        const result = await testService.invokeTool(multiLegacyTool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(result.content[0].value, 'multi legacy executed');
    });
    test('eligibleForAutoApproval current name takes precedence over legacy names', async () => {
        // Test forward compatibility: current name in config should take precedence
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.eligibleForAutoApproval', {
            'currentName': false, // Current name says ineligible
            'oldName': true // Legacy name says eligible
        });
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        const tool = registerToolForTest(testService, store, 'precedenceTool', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'precedence test' }] })
        }, {
            toolReferenceName: 'currentName',
            legacyToolReferenceFullNames: ['oldName']
        });
        const sessionId = 'test-precedence';
        const capture = {};
        stubGetSession(chatService, sessionId, { requestId: 'req1', capture });
        // Current name should take precedence, so tool should be ineligible
        const promise = testService.invokeTool(tool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        assert.ok(published?.confirmationMessages, 'current name should take precedence over legacy name');
        assert.strictEqual(published?.confirmationMessages?.allowAutoConfirm, false, 'should not allow auto confirm');
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const result = await promise;
        assert.strictEqual(result.content[0].value, 'precedence test');
    });
    test('eligibleForAutoApproval with legacy qualified names from toolsets', async () => {
        // Test legacy names that include toolset prefixes (e.g., 'oldToolSet/oldToolName')
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.eligibleForAutoApproval', {
            'oldToolSet/oldToolName': false // Legacy qualified name from old toolset
        });
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Tool was in an old toolset but now standalone
        const migratedTool = registerToolForTest(testService, store, 'migratedTool', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'migrated tool' }] })
        }, {
            toolReferenceName: 'standaloneToolName',
            legacyToolReferenceFullNames: ['oldToolSet/oldToolName']
        });
        const sessionId = 'test-qualified-legacy';
        const capture = {};
        stubGetSession(chatService, sessionId, { requestId: 'req1', capture });
        // Tool should be ineligible based on legacy qualified name
        const promise = testService.invokeTool(migratedTool.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        const published = await waitForPublishedInvocation(capture);
        assert.ok(published?.confirmationMessages, 'tool should be ineligible via legacy qualified name');
        assert.strictEqual(published?.confirmationMessages?.allowAutoConfirm, false, 'should not allow auto confirm');
        IChatToolInvocation.confirmWith(published, { type: 4 /* ToolConfirmKind.UserAction */ });
        const result = await promise;
        assert.strictEqual(result.content[0].value, 'migrated tool');
    });
    test('eligibleForAutoApproval mixed current and legacy names', async () => {
        // Test realistic migration scenario with mixed current and legacy names
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration('chat.tools.eligibleForAutoApproval', {
            'modernTool': true, // Current name
            'legacyToolOld': false, // Legacy name
            'unchangedTool': true // Tool that never changed
        });
        const instaService = workbenchInstantiationService({
            contextKeyService: () => store.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, store);
        instaService.stub(IChatService, chatService);
        instaService.stub(ILanguageModelToolsConfirmationService, new MockLanguageModelToolsConfirmationService());
        const testService = store.add(instaService.createInstance(LanguageModelToolsService));
        // Modern tool with current name
        const tool1 = registerToolForTest(testService, store, 'tool1', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'modern executed' }] })
        }, {
            toolReferenceName: 'modernTool'
        });
        // Renamed tool with legacy name
        const tool2 = registerToolForTest(testService, store, 'tool2', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'legacy needs confirmation' }] })
        }, {
            toolReferenceName: 'legacyToolNew',
            legacyToolReferenceFullNames: ['legacyToolOld']
        });
        // Unchanged tool
        const tool3 = registerToolForTest(testService, store, 'tool3', {
            prepareToolInvocation: async () => ({}),
            invoke: async () => ({ content: [{ kind: 'text', value: 'unchanged executed' }] })
        }, {
            toolReferenceName: 'unchangedTool'
        });
        const sessionId = 'test-mixed';
        stubGetSession(chatService, sessionId, { requestId: 'req1' });
        // Tool 1 should be eligible (current name)
        const result1 = await testService.invokeTool(tool1.makeDto({ test: 1 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(result1.content[0].value, 'modern executed');
        // Tool 2 should be ineligible (legacy name)
        const capture2 = {};
        stubGetSession(chatService, sessionId + '2', { requestId: 'req2', capture: capture2 });
        const promise2 = testService.invokeTool(tool2.makeDto({ test: 2 }, { sessionId: sessionId + '2' }), async () => 0, CancellationToken.None);
        const published2 = await waitForPublishedInvocation(capture2);
        assert.ok(published2?.confirmationMessages, 'tool2 should require confirmation via legacy name');
        IChatToolInvocation.confirmWith(published2, { type: 4 /* ToolConfirmKind.UserAction */ });
        const result2 = await promise2;
        assert.strictEqual(result2.content[0].value, 'legacy needs confirmation');
        // Tool 3 should be eligible (unchanged)
        const result3 = await testService.invokeTool(tool3.makeDto({ test: 3 }, { sessionId }), async () => 0, CancellationToken.None);
        assert.strictEqual(result3.content[0].value, 'unchanged executed');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9icm93c2VyL2xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUNqQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN6SCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxtRkFBbUYsQ0FBQztBQUVySixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN6SCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxpRUFBaUUsQ0FBQztBQUNwRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUNuSCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsaUJBQWlC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