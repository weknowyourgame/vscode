/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ResourceSet } from '../../../../../../base/common/map.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ContextKeyService } from '../../../../../../platform/contextkey/browser/contextKeyService.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ExtensionIdentifier } from '../../../../../../platform/extensions/common/extensions.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { MarkerSeverity } from '../../../../../../platform/markers/common/markers.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { LanguageModelToolsService } from '../../../browser/languageModelToolsService.js';
import { ChatMode, CustomChatMode, IChatModeService } from '../../../common/chatModes.js';
import { IChatService } from '../../../common/chatService.js';
import { ChatConfiguration } from '../../../common/constants.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../../common/languageModelToolsService.js';
import { ILanguageModelsService } from '../../../common/languageModels.js';
import { getPromptFileExtension } from '../../../common/promptSyntax/config/promptFileLocations.js';
import { PromptValidator } from '../../../common/promptSyntax/languageProviders/promptValidator.js';
import { PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { PromptFileParser } from '../../../common/promptSyntax/promptFileParser.js';
import { PromptsStorage } from '../../../common/promptSyntax/service/promptsService.js';
import { MockChatModeService } from '../../common/mockChatModeService.js';
import { MockChatService } from '../../common/mockChatService.js';
suite('PromptValidator', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instaService;
    const existingRef1 = URI.parse('myFs://test/reference1.md');
    const existingRef2 = URI.parse('myFs://test/reference2.md');
    setup(async () => {
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration(ChatConfiguration.ExtensionToolsEnabled, true);
        instaService = workbenchInstantiationService({
            contextKeyService: () => disposables.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, disposables);
        const chatService = new MockChatService();
        instaService.stub(IChatService, chatService);
        instaService.stub(ILabelService, { getUriLabel: (resource) => resource.path });
        const toolService = disposables.add(instaService.createInstance(LanguageModelToolsService));
        const testTool1 = { id: 'testTool1', displayName: 'tool1', canBeReferencedInPrompt: true, modelDescription: 'Test Tool 1', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(testTool1));
        const testTool2 = { id: 'testTool2', displayName: 'tool2', canBeReferencedInPrompt: true, toolReferenceName: 'tool2', modelDescription: 'Test Tool 2', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(testTool2));
        const shellTool = { id: 'shell', displayName: 'shell', canBeReferencedInPrompt: true, toolReferenceName: 'shell', modelDescription: 'Runs commands in the terminal', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(shellTool));
        const myExtSource = { type: 'extension', label: 'My Extension', extensionId: new ExtensionIdentifier('My.extension') };
        const testTool3 = { id: 'testTool3', displayName: 'tool3', canBeReferencedInPrompt: true, toolReferenceName: 'tool3', modelDescription: 'Test Tool 3', source: myExtSource, inputSchema: {} };
        disposables.add(toolService.registerToolData(testTool3));
        const prExtSource = { type: 'extension', label: 'GitHub Pull Request Extension', extensionId: new ExtensionIdentifier('github.vscode-pull-request-github') };
        const prExtTool1 = { id: 'suggestFix', canBeReferencedInPrompt: true, toolReferenceName: 'suggest-fix', modelDescription: 'tool4', displayName: 'Test Tool 4', source: prExtSource, inputSchema: {} };
        disposables.add(toolService.registerToolData(prExtTool1));
        const toolWithLegacy = { id: 'newTool', toolReferenceName: 'newToolRef', displayName: 'New Tool', canBeReferencedInPrompt: true, modelDescription: 'New Tool', source: ToolDataSource.External, inputSchema: {}, legacyToolReferenceFullNames: ['oldToolName', 'deprecatedToolName'] };
        disposables.add(toolService.registerToolData(toolWithLegacy));
        const toolSetWithLegacy = disposables.add(toolService.createToolSet(ToolDataSource.External, 'newToolSet', 'newToolSetRef', { description: 'New Tool Set', legacyFullNames: ['oldToolSet', 'deprecatedToolSet'] }));
        const toolInSet = { id: 'toolInSet', toolReferenceName: 'toolInSetRef', displayName: 'Tool In Set', canBeReferencedInPrompt: false, modelDescription: 'Tool In Set', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(toolInSet));
        disposables.add(toolSetWithLegacy.addTool(toolInSet));
        const anotherToolWithLegacy = { id: 'anotherTool', toolReferenceName: 'anotherToolRef', displayName: 'Another Tool', canBeReferencedInPrompt: true, modelDescription: 'Another Tool', source: ToolDataSource.External, inputSchema: {}, legacyToolReferenceFullNames: ['legacyTool'] };
        disposables.add(toolService.registerToolData(anotherToolWithLegacy));
        const anotherToolSetWithLegacy = disposables.add(toolService.createToolSet(ToolDataSource.External, 'anotherToolSet', 'anotherToolSetRef', { description: 'Another Tool Set', legacyFullNames: ['legacyToolSet'] }));
        const anotherToolInSet = { id: 'anotherToolInSet', toolReferenceName: 'anotherToolInSetRef', displayName: 'Another Tool In Set', canBeReferencedInPrompt: false, modelDescription: 'Another Tool In Set', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(anotherToolInSet));
        disposables.add(anotherToolSetWithLegacy.addTool(anotherToolInSet));
        const conflictToolSet1 = disposables.add(toolService.createToolSet(ToolDataSource.External, 'conflictSet1', 'conflictSet1Ref', { legacyFullNames: ['sharedLegacyName'] }));
        const conflictTool1 = { id: 'conflictTool1', toolReferenceName: 'conflictTool1Ref', displayName: 'Conflict Tool 1', canBeReferencedInPrompt: false, modelDescription: 'Conflict Tool 1', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(conflictTool1));
        disposables.add(conflictToolSet1.addTool(conflictTool1));
        const conflictToolSet2 = disposables.add(toolService.createToolSet(ToolDataSource.External, 'conflictSet2', 'conflictSet2Ref', { legacyFullNames: ['sharedLegacyName'] }));
        const conflictTool2 = { id: 'conflictTool2', toolReferenceName: 'conflictTool2Ref', displayName: 'Conflict Tool 2', canBeReferencedInPrompt: false, modelDescription: 'Conflict Tool 2', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(conflictTool2));
        disposables.add(conflictToolSet2.addTool(conflictTool2));
        instaService.set(ILanguageModelToolsService, toolService);
        const testModels = [
            { id: 'mae-4', name: 'MAE 4', vendor: 'olama', version: '1.0', family: 'mae', modelPickerCategory: undefined, extension: new ExtensionIdentifier('a.b'), isUserSelectable: true, maxInputTokens: 8192, maxOutputTokens: 1024, capabilities: { agentMode: true, toolCalling: true } },
            { id: 'mae-4.1', name: 'MAE 4.1', vendor: 'copilot', version: '1.0', family: 'mae', modelPickerCategory: undefined, extension: new ExtensionIdentifier('a.b'), isUserSelectable: true, maxInputTokens: 8192, maxOutputTokens: 1024, capabilities: { agentMode: true, toolCalling: true } },
            { id: 'mae-3.5-turbo', name: 'MAE 3.5 Turbo', vendor: 'copilot', version: '1.0', family: 'mae', modelPickerCategory: undefined, extension: new ExtensionIdentifier('a.b'), isUserSelectable: true, maxInputTokens: 8192, maxOutputTokens: 1024 }
        ];
        instaService.stub(ILanguageModelsService, {
            getLanguageModelIds() { return testModels.map(m => m.id); },
            lookupLanguageModel(name) {
                return testModels.find(m => m.id === name);
            }
        });
        const customChatMode = new CustomChatMode({
            uri: URI.parse('myFs://test/test/chatmode.md'),
            name: 'BeastMode',
            agentInstructions: { content: 'Beast mode instructions', toolReferences: [] },
            source: { storage: PromptsStorage.local }
        });
        instaService.stub(IChatModeService, new MockChatModeService({ builtin: [ChatMode.Agent, ChatMode.Ask, ChatMode.Edit], custom: [customChatMode] }));
        const existingFiles = new ResourceSet([existingRef1, existingRef2]);
        instaService.stub(IFileService, {
            exists(uri) {
                return Promise.resolve(existingFiles.has(uri));
            }
        });
    });
    async function validate(code, promptType) {
        const uri = URI.parse('myFs://test/testFile' + getPromptFileExtension(promptType));
        const result = new PromptFileParser().parse(uri, code);
        const validator = instaService.createInstance(PromptValidator);
        const markers = [];
        await validator.validate(result, promptType, m => markers.push(m));
        return markers;
    }
    suite('agents', () => {
        test('correct agent', async () => {
            const content = [
                /* 01 */ '---',
                /* 02 */ `description: "Agent mode test"`,
                /* 03 */ 'model: MAE 4.1',
                /* 04 */ `tools: ['tool1', 'tool2']`,
                /* 05 */ '---',
                /* 06 */ 'This is a chat agent test.',
                /* 07 */ 'Here is a #tool1 variable and a #file:./reference1.md as well as a [reference](./reference2.md).',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.deepStrictEqual(markers, []);
        });
        test('agent with errors (empty description, unknown tool & model)', async () => {
            const content = [
                /* 01 */ '---',
                /* 02 */ `description: ""`, // empty description -> error
                /* 03 */ 'model: MAE 4.2', // unknown model -> warning
                /* 04 */ `tools: ['tool1', 'tool2', 'tool4', 'my.extension/tool3']`, // tool4 unknown -> error
                /* 05 */ '---',
                /* 06 */ 'Body',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.deepStrictEqual(markers.map(m => ({ severity: m.severity, message: m.message })), [
                { severity: MarkerSeverity.Error, message: `The 'description' attribute should not be empty.` },
                { severity: MarkerSeverity.Warning, message: `Unknown tool 'tool4'.` },
                { severity: MarkerSeverity.Warning, message: `Unknown model 'MAE 4.2'.` },
            ]);
        });
        test('tools must be array', async () => {
            const content = [
                '---',
                'description: "Test"',
                `tools: 'tool1'`,
                '---',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.strictEqual(markers.length, 1);
            assert.deepStrictEqual(markers.map(m => m.message), [`The 'tools' attribute must be an array.`]);
        });
        test('each tool must be string', async () => {
            const content = [
                '---',
                'description: "Test"',
                `tools: ['tool1', 2]`,
                '---',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.deepStrictEqual(markers.map(m => ({ severity: m.severity, message: m.message })), [
                { severity: MarkerSeverity.Error, message: `Each tool name in the 'tools' attribute must be a string.` },
            ]);
        });
        test('old tool reference', async () => {
            const content = [
                '---',
                'description: "Test"',
                `tools: ['tool1', 'tool3']`,
                '---',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.deepStrictEqual(markers.map(m => ({ severity: m.severity, message: m.message })), [
                { severity: MarkerSeverity.Info, message: `Tool or toolset 'tool3' has been renamed, use 'my.extension/tool3' instead.` },
            ]);
        });
        test('legacy tool reference names', async () => {
            // Test using legacy tool reference name
            {
                const content = [
                    '---',
                    'description: "Test"',
                    `tools: ['tool1', 'oldToolName']`,
                    '---',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.deepStrictEqual(markers.map(m => ({ severity: m.severity, message: m.message })), [
                    { severity: MarkerSeverity.Info, message: `Tool or toolset 'oldToolName' has been renamed, use 'newToolRef' instead.` },
                ]);
            }
            // Test using another legacy tool reference name
            {
                const content = [
                    '---',
                    'description: "Test"',
                    `tools: ['tool1', 'deprecatedToolName']`,
                    '---',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.deepStrictEqual(markers.map(m => ({ severity: m.severity, message: m.message })), [
                    { severity: MarkerSeverity.Info, message: `Tool or toolset 'deprecatedToolName' has been renamed, use 'newToolRef' instead.` },
                ]);
            }
        });
        test('legacy toolset names', async () => {
            // Test using legacy toolset name
            {
                const content = [
                    '---',
                    'description: "Test"',
                    `tools: ['tool1', 'oldToolSet']`,
                    '---',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.deepStrictEqual(markers.map(m => ({ severity: m.severity, message: m.message })), [
                    { severity: MarkerSeverity.Info, message: `Tool or toolset 'oldToolSet' has been renamed, use 'newToolSetRef' instead.` },
                ]);
            }
            // Test using another legacy toolset name
            {
                const content = [
                    '---',
                    'description: "Test"',
                    `tools: ['tool1', 'deprecatedToolSet']`,
                    '---',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.deepStrictEqual(markers.map(m => ({ severity: m.severity, message: m.message })), [
                    { severity: MarkerSeverity.Info, message: `Tool or toolset 'deprecatedToolSet' has been renamed, use 'newToolSetRef' instead.` },
                ]);
            }
        });
        test('multiple legacy names in same tools list', async () => {
            // Test multiple legacy names together
            const content = [
                '---',
                'description: "Test"',
                `tools: ['legacyTool', 'legacyToolSet', 'tool3']`,
                '---',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.deepStrictEqual(markers.map(m => ({ severity: m.severity, message: m.message })), [
                { severity: MarkerSeverity.Info, message: `Tool or toolset 'legacyTool' has been renamed, use 'anotherToolRef' instead.` },
                { severity: MarkerSeverity.Info, message: `Tool or toolset 'legacyToolSet' has been renamed, use 'anotherToolSetRef' instead.` },
                { severity: MarkerSeverity.Info, message: `Tool or toolset 'tool3' has been renamed, use 'my.extension/tool3' instead.` },
            ]);
        });
        test('deprecated tool name mapping to multiple new names', async () => {
            // The toolsets are registered in setup with a shared legacy name 'sharedLegacyName'
            // This simulates the case where one deprecated name maps to multiple current names
            const content = [
                '---',
                'description: "Test"',
                `tools: ['sharedLegacyName']`,
                '---',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.strictEqual(markers.length, 1);
            assert.strictEqual(markers[0].severity, MarkerSeverity.Info);
            // When multiple toolsets share the same legacy name, the message should indicate multiple options
            // The message will say "use the following tools instead:" for multiple mappings
            const expectedMessage = `Tool or toolset 'sharedLegacyName' has been renamed, use the following tools instead: conflictSet1Ref, conflictSet2Ref`;
            assert.strictEqual(markers[0].message, expectedMessage);
        });
        test('deprecated tool name in body variable reference - single mapping', async () => {
            // Test deprecated tool name used as variable reference in body
            const content = [
                '---',
                'description: "Test"',
                '---',
                'Body with #tool:oldToolName reference',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.strictEqual(markers.length, 1);
            assert.strictEqual(markers[0].severity, MarkerSeverity.Info);
            assert.strictEqual(markers[0].message, `Tool or toolset 'oldToolName' has been renamed, use 'newToolRef' instead.`);
        });
        test('deprecated tool name in body variable reference - multiple mappings', async () => {
            // Register tools with the same legacy name to create multiple mappings
            const multiMapToolSet1 = disposables.add(instaService.get(ILanguageModelToolsService).createToolSet(ToolDataSource.External, 'multiMapSet1', 'multiMapSet1Ref', { legacyFullNames: ['multiMapLegacy'] }));
            const multiMapTool1 = { id: 'multiMapTool1', toolReferenceName: 'multiMapTool1Ref', displayName: 'Multi Map Tool 1', canBeReferencedInPrompt: true, modelDescription: 'Multi Map Tool 1', source: ToolDataSource.External, inputSchema: {} };
            disposables.add(instaService.get(ILanguageModelToolsService).registerToolData(multiMapTool1));
            disposables.add(multiMapToolSet1.addTool(multiMapTool1));
            const multiMapToolSet2 = disposables.add(instaService.get(ILanguageModelToolsService).createToolSet(ToolDataSource.External, 'multiMapSet2', 'multiMapSet2Ref', { legacyFullNames: ['multiMapLegacy'] }));
            const multiMapTool2 = { id: 'multiMapTool2', toolReferenceName: 'multiMapTool2Ref', displayName: 'Multi Map Tool 2', canBeReferencedInPrompt: true, modelDescription: 'Multi Map Tool 2', source: ToolDataSource.External, inputSchema: {} };
            disposables.add(instaService.get(ILanguageModelToolsService).registerToolData(multiMapTool2));
            disposables.add(multiMapToolSet2.addTool(multiMapTool2));
            const content = [
                '---',
                'description: "Test"',
                '---',
                'Body with #tool:multiMapLegacy reference',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.strictEqual(markers.length, 1);
            assert.strictEqual(markers[0].severity, MarkerSeverity.Info);
            // When multiple toolsets share the same legacy name, the message should indicate multiple options
            // The message will say "use the following tools instead:" for multiple mappings in body references
            const expectedMessage = `Tool or toolset 'multiMapLegacy' has been renamed, use the following tools instead: multiMapSet1Ref, multiMapSet2Ref`;
            assert.strictEqual(markers[0].message, expectedMessage);
        });
        test('unknown attribute in agent file', async () => {
            const content = [
                '---',
                'description: "Test"',
                `applyTo: '*.ts'`, // not allowed in agent file
                '---',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.deepStrictEqual(markers.map(m => ({ severity: m.severity, message: m.message })), [
                { severity: MarkerSeverity.Warning, message: `Attribute 'applyTo' is not supported in VS Code agent files. Supported: argument-hint, description, handoffs, model, name, target, tools.` },
            ]);
        });
        test('tools with invalid handoffs', async () => {
            {
                const content = [
                    '---',
                    'description: "Test"',
                    `handoffs: next`,
                    '---',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.strictEqual(markers.length, 1);
                assert.deepStrictEqual(markers.map(m => m.message), [`The 'handoffs' attribute must be an array.`]);
            }
            {
                const content = [
                    '---',
                    'description: "Test"',
                    `handoffs:`,
                    `  - label: '123'`,
                    '---',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.strictEqual(markers.length, 1);
                assert.deepStrictEqual(markers.map(m => m.message), [`Missing required properties 'agent', 'prompt' in handoff object.`]);
            }
            {
                const content = [
                    '---',
                    'description: "Test"',
                    `handoffs:`,
                    `  - label: '123'`,
                    `    agent: ''`,
                    `    prompt: ''`,
                    `    send: true`,
                    '---',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.strictEqual(markers.length, 1);
                assert.deepStrictEqual(markers.map(m => m.message), [`The 'agent' property in a handoff must be a non-empty string.`]);
            }
            {
                const content = [
                    '---',
                    'description: "Test"',
                    `handoffs:`,
                    `  - label: '123'`,
                    `    agent: 'Cool'`,
                    `    prompt: ''`,
                    `    send: true`,
                    '---',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.strictEqual(markers.length, 1);
                assert.deepStrictEqual(markers.map(m => m.message), [`Unknown agent 'Cool'. Available agents: agent, ask, edit, BeastMode.`]);
            }
        });
        test('agent with handoffs attribute', async () => {
            const content = [
                '---',
                'description: \"Test agent with handoffs\"',
                `handoffs:`,
                '  - label: Test Prompt',
                '    agent: agent',
                '    prompt: Add tests for this code',
                '  - label: Optimize Performance',
                '    agent: agent',
                '    prompt: Optimize for performance',
                '---',
                'Body',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.deepStrictEqual(markers, [], 'Expected no validation issues for handoffs attribute');
        });
        test('github-copilot agent with supported attributes', async () => {
            const content = [
                '---',
                'name: "GitHub_Copilot_Custom_Agent"',
                'description: "GitHub Copilot agent"',
                'target: github-copilot',
                `tools: ['shell', 'edit', 'search', 'custom-agent']`,
                'mcp-servers: []',
                '---',
                'Body with #search and #edit references',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.deepStrictEqual(markers, [], 'Expected no validation issues for github-copilot target');
        });
        test('github-copilot agent warns about model and handoffs attributes', async () => {
            const content = [
                '---',
                'name: "GitHubAgent"',
                'description: "GitHub Copilot agent"',
                'target: github-copilot',
                'model: MAE 4.1',
                `tools: ['shell', 'edit']`,
                `handoffs:`,
                '  - label: Test',
                '    agent: Default',
                '    prompt: Test',
                '---',
                'Body',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            const messages = markers.map(m => m.message);
            assert.deepStrictEqual(messages, [
                'Attribute \'model\' is not supported in custom GitHub Copilot agent files. Supported: description, mcp-servers, name, target, tools.',
                'Attribute \'handoffs\' is not supported in custom GitHub Copilot agent files. Supported: description, mcp-servers, name, target, tools.',
            ], 'Model and handoffs are not validated for github-copilot target');
        });
        test('github-copilot agent does not validate variable references', async () => {
            const content = [
                '---',
                'name: "GitHubAgent"',
                'description: "GitHub Copilot agent"',
                'target: github-copilot',
                `tools: ['shell', 'edit']`,
                '---',
                'Body with #unknownTool reference',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            // Variable references should not be validated for github-copilot target
            assert.deepStrictEqual(markers, [], 'Variable references are not validated for github-copilot target');
        });
        test('github-copilot agent rejects unsupported attributes', async () => {
            const content = [
                '---',
                'name: "GitHubAgent"',
                'description: "GitHub Copilot agent"',
                'target: github-copilot',
                'argument-hint: "test hint"',
                `tools: ['shell']`,
                '---',
                'Body',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.strictEqual(markers.length, 1);
            assert.strictEqual(markers[0].severity, MarkerSeverity.Warning);
            assert.ok(markers[0].message.includes(`Attribute 'argument-hint' is not supported`), 'Expected warning about unsupported attribute');
        });
        test('vscode target agent validates normally', async () => {
            const content = [
                '---',
                'description: "VS Code agent"',
                'target: vscode',
                'model: MAE 4.1',
                `tools: ['tool1', 'tool2']`,
                '---',
                'Body with #tool1',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.deepStrictEqual(markers, [], 'VS Code target should validate normally');
        });
        test('vscode target agent warns about unknown tools', async () => {
            const content = [
                '---',
                'description: "VS Code agent"',
                'target: vscode',
                `tools: ['tool1', 'unknownTool']`,
                '---',
                'Body',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            assert.strictEqual(markers.length, 1);
            assert.strictEqual(markers[0].severity, MarkerSeverity.Warning);
            assert.strictEqual(markers[0].message, `Unknown tool 'unknownTool'.`);
        });
        test('vscode target agent with mcp-servers and github-tools', async () => {
            const content = [
                '---',
                'description: "VS Code agent"',
                'target: vscode',
                `tools: ['tool1', 'edit']`,
                `mcp-servers: {}`,
                '---',
                'Body',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            const messages = markers.map(m => m.message);
            assert.deepStrictEqual(messages, [
                'Attribute \'mcp-servers\' is ignored when running locally in VS Code.',
                'Unknown tool \'edit\'.',
            ]);
        });
        test('undefined target with mcp-servers and github-tools', async () => {
            const content = [
                '---',
                'description: "VS Code agent"',
                `tools: ['tool1', 'shell']`,
                `mcp-servers: {}`,
                '---',
                'Body',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            const messages = markers.map(m => m.message);
            assert.deepStrictEqual(messages, [
                'Attribute \'mcp-servers\' is ignored when running locally in VS Code.',
            ]);
        });
        test('default target (no target specified) validates as vscode', async () => {
            const content = [
                '---',
                'description: "Agent without target"',
                'model: MAE 4.1',
                `tools: ['tool1']`,
                'argument-hint: "test hint"',
                '---',
                'Body',
            ].join('\n');
            const markers = await validate(content, PromptsType.agent);
            // Should validate normally as if target was vscode
            assert.deepStrictEqual(markers, [], 'Agent without target should validate as vscode');
        });
        test('name attribute validation', async () => {
            // Valid name
            {
                const content = [
                    '---',
                    'name: "MyAgent"',
                    'description: "Test agent"',
                    'target: vscode',
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.deepStrictEqual(markers, [], 'Valid name should not produce errors');
            }
            // Empty name
            {
                const content = [
                    '---',
                    'name: ""',
                    'description: "Test agent"',
                    'target: vscode',
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.strictEqual(markers.length, 1);
                assert.strictEqual(markers[0].severity, MarkerSeverity.Error);
                assert.strictEqual(markers[0].message, `The 'name' attribute must not be empty.`);
            }
            // Non-string name
            {
                const content = [
                    '---',
                    'name: 123',
                    'description: "Test agent"',
                    'target: vscode',
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.strictEqual(markers.length, 1);
                assert.strictEqual(markers[0].severity, MarkerSeverity.Error);
                assert.strictEqual(markers[0].message, `The 'name' attribute must be a string.`);
            }
            // Valid name with allowed characters
            {
                const content = [
                    '---',
                    'name: "My_Agent-2.0 with spaces"',
                    'description: "Test agent"',
                    'target: vscode',
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.deepStrictEqual(markers, [], 'Name with allowed characters should be valid');
            }
        });
        test('github-copilot target requires name attribute', async () => {
            // Missing name with github-copilot target
            {
                const content = [
                    '---',
                    'description: "GitHub Copilot agent"',
                    'target: github-copilot',
                    `tools: ['shell']`,
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.strictEqual(markers.length, 0);
            }
            // Valid name with github-copilot target
            {
                const content = [
                    '---',
                    'name: "GitHubAgent"',
                    'description: "GitHub Copilot agent"',
                    'target: github-copilot',
                    `tools: ['shell']`,
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.deepStrictEqual(markers, [], 'Valid github-copilot agent with name should not produce errors');
            }
            // Missing name with vscode target (should be optional)
            {
                const content = [
                    '---',
                    'description: "VS Code agent"',
                    'target: vscode',
                    `tools: ['tool1']`,
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.agent);
                assert.deepStrictEqual(markers, [], 'Name should be optional for vscode target');
            }
        });
    });
    suite('instructions', () => {
        test('instructions valid', async () => {
            const content = [
                '---',
                'description: "Instr"',
                'applyTo: *.ts,*.js',
                '---',
            ].join('\n');
            const markers = await validate(content, PromptsType.instructions);
            assert.deepEqual(markers, []);
        });
        test('instructions invalid applyTo type', async () => {
            const content = [
                '---',
                'description: "Instr"',
                'applyTo: 5',
                '---',
            ].join('\n');
            const markers = await validate(content, PromptsType.instructions);
            assert.strictEqual(markers.length, 1);
            assert.strictEqual(markers[0].message, `The 'applyTo' attribute must be a string.`);
        });
        test('instructions invalid applyTo glob & unknown attribute', async () => {
            const content = [
                '---',
                'description: "Instr"',
                `applyTo: ''`, // empty -> invalid glob
                'model: mae-4', // model not allowed in instructions
                '---',
            ].join('\n');
            const markers = await validate(content, PromptsType.instructions);
            assert.strictEqual(markers.length, 2);
            // Order: unknown attribute warnings first (attribute iteration) then applyTo validation
            assert.strictEqual(markers[0].severity, MarkerSeverity.Warning);
            assert.ok(markers[0].message.startsWith(`Attribute 'model' is not supported in instructions files.`));
            assert.strictEqual(markers[1].message, `The 'applyTo' attribute must be a valid glob pattern.`);
        });
        test('invalid header structure (YAML array)', async () => {
            const content = [
                '---',
                '- item1',
                '---',
                'Body',
            ].join('\n');
            const markers = await validate(content, PromptsType.instructions);
            assert.strictEqual(markers.length, 1);
            assert.strictEqual(markers[0].message, 'Invalid header, expecting <key: value> pairs');
        });
        test('name attribute validation in instructions', async () => {
            // Valid name
            {
                const content = [
                    '---',
                    'name: "MyInstructions"',
                    'description: "Test instructions"',
                    'applyTo: "**/*.ts"',
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.instructions);
                assert.deepStrictEqual(markers, [], 'Valid name should not produce errors');
            }
            // Empty name
            {
                const content = [
                    '---',
                    'name: ""',
                    'description: "Test instructions"',
                    'applyTo: "**/*.ts"',
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.instructions);
                assert.strictEqual(markers.length, 1);
                assert.strictEqual(markers[0].severity, MarkerSeverity.Error);
                assert.strictEqual(markers[0].message, `The 'name' attribute must not be empty.`);
            }
        });
    });
    suite('prompts', () => {
        test('prompt valid with agent mode (default) and tools and a BYO model', async () => {
            // mode omitted -> defaults to Agent; tools+model should validate; model MAE 4 is agent capable
            const content = [
                '---',
                'description: "Prompt with tools"',
                'model: MAE 4.1',
                `tools: ['tool1','tool2']`,
                '---',
                'Body'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.deepStrictEqual(markers, []);
        });
        test('prompt model not suited for agent mode', async () => {
            // MAE 3.5 Turbo lacks agentMode capability -> warning when used in agent (default)
            const content = [
                '---',
                'description: "Prompt with unsuitable model"',
                'model: MAE 3.5 Turbo',
                '---',
                'Body'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.strictEqual(markers.length, 1, 'Expected one warning about unsuitable model');
            assert.strictEqual(markers[0].severity, MarkerSeverity.Warning);
            assert.strictEqual(markers[0].message, `Model 'MAE 3.5 Turbo' is not suited for agent mode.`);
        });
        test('prompt with custom agent BeastMode and tools', async () => {
            // Explicit custom agent should be recognized; BeastMode kind comes from setup; ensure tools accepted
            const content = [
                '---',
                'description: "Prompt custom mode"',
                'agent: BeastMode',
                `tools: ['tool1']`,
                '---',
                'Body'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.deepStrictEqual(markers, []);
        });
        test('prompt with custom mode BeastMode and tools', async () => {
            // Explicit custom mode should be recognized; BeastMode kind comes from setup; ensure tools accepted
            const content = [
                '---',
                'description: "Prompt custom mode"',
                'mode: BeastMode',
                `tools: ['tool1']`,
                '---',
                'Body'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.strictEqual(markers.length, 1);
            assert.deepStrictEqual(markers.map(m => m.message), [`The 'mode' attribute has been deprecated. Please rename it to 'agent'.`]);
        });
        test('prompt with custom mode an agent', async () => {
            // Explicit custom mode should be recognized; BeastMode kind comes from setup; ensure tools accepted
            const content = [
                '---',
                'description: "Prompt custom mode"',
                'mode: BeastMode',
                `agent: agent`,
                '---',
                'Body'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.strictEqual(markers.length, 1);
            assert.deepStrictEqual(markers.map(m => m.message), [`The 'mode' attribute has been deprecated. The 'agent' attribute is used instead.`]);
        });
        test('prompt with unknown agent Ask', async () => {
            const content = [
                '---',
                'description: "Prompt unknown agent Ask"',
                'agent: Ask',
                `tools: ['tool1','tool2']`,
                '---',
                'Body'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.strictEqual(markers.length, 1, 'Expected one warning about tools in non-agent mode');
            assert.strictEqual(markers[0].severity, MarkerSeverity.Warning);
            assert.strictEqual(markers[0].message, `Unknown agent 'Ask'. Available agents: agent, ask, edit, BeastMode.`);
        });
        test('prompt with agent edit', async () => {
            const content = [
                '---',
                'description: "Prompt edit mode with tool"',
                'agent: edit',
                `tools: ['tool1']`,
                '---',
                'Body'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.strictEqual(markers.length, 1);
            assert.strictEqual(markers[0].severity, MarkerSeverity.Warning);
            assert.strictEqual(markers[0].message, `The 'tools' attribute is only supported when using agents. Attribute will be ignored.`);
        });
        test('name attribute validation in prompts', async () => {
            // Valid name
            {
                const content = [
                    '---',
                    'name: "MyPrompt"',
                    'description: "Test prompt"',
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.prompt);
                assert.deepStrictEqual(markers, [], 'Valid name should not produce errors');
            }
            // Empty name
            {
                const content = [
                    '---',
                    'name: ""',
                    'description: "Test prompt"',
                    '---',
                    'Body',
                ].join('\n');
                const markers = await validate(content, PromptsType.prompt);
                assert.strictEqual(markers.length, 1);
                assert.strictEqual(markers[0].severity, MarkerSeverity.Error);
                assert.strictEqual(markers[0].message, `The 'name' attribute must not be empty.`);
            }
        });
    });
    suite('body', () => {
        test('body with existing file references and known tools has no markers', async () => {
            const content = [
                '---',
                'description: "Refs"',
                '---',
                'Here is a #file:./reference1.md and a markdown [reference](./reference2.md) plus variables #tool1 and #tool2'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.deepStrictEqual(markers, [], 'Expected no validation issues');
        });
        test('body with missing file references reports warnings', async () => {
            const content = [
                '---',
                'description: "Missing Refs"',
                '---',
                'Here is a #file:./missing1.md and a markdown [missing link](./missing2.md).'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            const messages = markers.map(m => m.message).sort();
            assert.deepStrictEqual(messages, [
                `File './missing1.md' not found at '/missing1.md'.`,
                `File './missing2.md' not found at '/missing2.md'.`
            ]);
        });
        test('body with http link', async () => {
            const content = [
                '---',
                'description: "HTTP Link"',
                '---',
                'Here is a [http link](http://example.com).'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.deepStrictEqual(markers, [], 'Expected no validation issues');
        });
        test('body with url link', async () => {
            const nonExistingRef = existingRef1.with({ path: '/nonexisting' });
            const content = [
                '---',
                'description: "URL Links"',
                '---',
                `Here is a [url link](${existingRef1.toString()}).`,
                `Here is a [url link](${nonExistingRef.toString()}).`
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            const messages = markers.map(m => m.message).sort();
            assert.deepStrictEqual(messages, [
                `File 'myFs://test/nonexisting' not found at '/nonexisting'.`,
            ]);
        });
        test('body with unknown tool variable reference warns', async () => {
            const content = [
                '---',
                'description: "Unknown tool var"',
                '---',
                'This line references known #tool:tool1 and unknown #tool:toolX'
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            assert.strictEqual(markers.length, 1, 'Expected one warning for unknown tool variable');
            assert.strictEqual(markers[0].severity, MarkerSeverity.Warning);
            assert.strictEqual(markers[0].message, `Unknown tool or toolset 'toolX'.`);
        });
        test('body with tool not present in tools list', async () => {
            const content = [
                '---',
                'tools: []',
                '---',
                'I need',
                '#tool:ms-azuretools.vscode-azure-github-copilot/azure_recommend_custom_modes',
                '#tool:github.vscode-pull-request-github/suggest-fix',
                '#tool:openSimpleBrowser',
            ].join('\n');
            const markers = await validate(content, PromptsType.prompt);
            const actual = markers.sort((a, b) => a.startLineNumber - b.startLineNumber).map(m => ({ message: m.message, startColumn: m.startColumn, endColumn: m.endColumn }));
            assert.deepEqual(actual, [
                { message: `Unknown tool or toolset 'ms-azuretools.vscode-azure-github-copilot/azure_recommend_custom_modes'.`, startColumn: 7, endColumn: 77 },
                { message: `Tool or toolset 'github.vscode-pull-request-github/suggest-fix' also needs to be enabled in the header.`, startColumn: 7, endColumn: 52 },
                { message: `Unknown tool or toolset 'openSimpleBrowser'.`, startColumn: 7, endColumn: 24 },
            ]);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0VmFsaWRhdG9yLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2Jyb3dzZXIvcHJvbXB0U3l0bnRheC9wcm9tcHRWYWxpZGF0b3IudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFNUIsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN0RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvRUFBb0UsQ0FBQztBQUN2RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxrRkFBa0YsQ0FBQztBQUM1SCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFaEYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2pGLE9BQU8sRUFBZSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNuRyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNyRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUMxRixPQUFPLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQzFGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNqRSxPQUFP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