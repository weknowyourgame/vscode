/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { Position } from '../../../../../../editor/common/core/position.js';
import { ContextKeyService } from '../../../../../../platform/contextkey/browser/contextKeyService.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ExtensionIdentifier } from '../../../../../../platform/extensions/common/extensions.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { LanguageModelToolsService } from '../../../browser/languageModelToolsService.js';
import { ChatMode, CustomChatMode, IChatModeService } from '../../../common/chatModes.js';
import { IChatService } from '../../../common/chatService.js';
import { ChatConfiguration } from '../../../common/constants.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../../common/languageModelToolsService.js';
import { ILanguageModelsService } from '../../../common/languageModels.js';
import { PromptHoverProvider } from '../../../common/promptSyntax/languageProviders/promptHovers.js';
import { IPromptsService, PromptsStorage } from '../../../common/promptSyntax/service/promptsService.js';
import { MockChatModeService } from '../../common/mockChatModeService.js';
import { MockChatService } from '../../common/mockChatService.js';
import { createTextModel } from '../../../../../../editor/test/common/testTextModel.js';
import { URI } from '../../../../../../base/common/uri.js';
import { PromptFileParser } from '../../../common/promptSyntax/promptFileParser.js';
import { MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { getLanguageIdForPromptsType, PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { getPromptFileExtension } from '../../../common/promptSyntax/config/promptFileLocations.js';
suite('PromptHoverProvider', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instaService;
    let hoverProvider;
    setup(async () => {
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration(ChatConfiguration.ExtensionToolsEnabled, true);
        instaService = workbenchInstantiationService({
            contextKeyService: () => disposables.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, disposables);
        const chatService = new MockChatService();
        instaService.stub(IChatService, chatService);
        const toolService = disposables.add(instaService.createInstance(LanguageModelToolsService));
        const testTool1 = { id: 'testTool1', displayName: 'tool1', canBeReferencedInPrompt: true, modelDescription: 'Test Tool 1', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(testTool1));
        const testTool2 = { id: 'testTool2', displayName: 'tool2', canBeReferencedInPrompt: true, toolReferenceName: 'tool2', modelDescription: 'Test Tool 2', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(testTool2));
        const shellTool = { id: 'shell', displayName: 'shell', canBeReferencedInPrompt: true, toolReferenceName: 'shell', modelDescription: 'Runs commands in the terminal', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(shellTool));
        instaService.set(ILanguageModelToolsService, toolService);
        const testModels = [
            { id: 'mae-4', name: 'MAE 4', vendor: 'olama', version: '1.0', family: 'mae', modelPickerCategory: undefined, extension: new ExtensionIdentifier('a.b'), isUserSelectable: true, maxInputTokens: 8192, maxOutputTokens: 1024, capabilities: { agentMode: true, toolCalling: true } },
            { id: 'mae-4.1', name: 'MAE 4.1', vendor: 'copilot', version: '1.0', family: 'mae', modelPickerCategory: undefined, extension: new ExtensionIdentifier('a.b'), isUserSelectable: true, maxInputTokens: 8192, maxOutputTokens: 1024, capabilities: { agentMode: true, toolCalling: true } },
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
        const parser = new PromptFileParser();
        instaService.stub(IPromptsService, {
            getParsedPromptFile(model) {
                return parser.parse(model.uri, model.getValue());
            }
        });
        hoverProvider = instaService.createInstance(PromptHoverProvider);
    });
    async function getHover(content, line, column, promptType) {
        const languageId = getLanguageIdForPromptsType(promptType);
        const model = disposables.add(createTextModel(content, languageId, undefined, URI.parse('test://test' + getPromptFileExtension(promptType))));
        const position = new Position(line, column);
        const hover = await hoverProvider.provideHover(model, position, CancellationToken.None);
        if (!hover || hover.contents.length === 0) {
            return undefined;
        }
        // Return the markdown value from the first content
        const firstContent = hover.contents[0];
        if (firstContent instanceof MarkdownString) {
            return firstContent.value;
        }
        return undefined;
    }
    suite('agent hovers', () => {
        test('hover on target attribute shows description', async () => {
            const content = [
                '---',
                'description: "Test"',
                'target: vscode',
                '---',
            ].join('\n');
            const hover = await getHover(content, 3, 1, PromptsType.agent);
            assert.strictEqual(hover, 'The target to which the header attributes like tools apply to. Possible values are `github-copilot` and `vscode`.');
        });
        test('hover on model attribute with github-copilot target shows note', async () => {
            const content = [
                '---',
                'description: "Test"',
                'target: github-copilot',
                'model: MAE 4',
                '---',
            ].join('\n');
            const hover = await getHover(content, 4, 1, PromptsType.agent);
            const expected = [
                'Specify the model that runs this custom agent.',
                '',
                'Note: This attribute is not used when target is github-copilot.'
            ].join('\n');
            assert.strictEqual(hover, expected);
        });
        test('hover on model attribute with vscode target shows model info', async () => {
            const content = [
                '---',
                'description: "Test"',
                'target: vscode',
                'model: MAE 4 (olama)',
                '---',
            ].join('\n');
            const hover = await getHover(content, 4, 1, PromptsType.agent);
            const expected = [
                'Specify the model that runs this custom agent.',
                '',
                '- Name: MAE 4',
                '- Family: mae',
                '- Vendor: olama'
            ].join('\n');
            assert.strictEqual(hover, expected);
        });
        test('hover on handoffs attribute with github-copilot target shows note', async () => {
            const content = [
                '---',
                'description: "Test"',
                'target: github-copilot',
                'handoffs:',
                '  - label: Test',
                '    agent: Default',
                '    prompt: Test',
                '---',
            ].join('\n');
            const hover = await getHover(content, 4, 1, PromptsType.agent);
            const expected = [
                'Possible handoff actions when the agent has completed its task.',
                '',
                'Note: This attribute is not used when target is github-copilot.'
            ].join('\n');
            assert.strictEqual(hover, expected);
        });
        test('hover on handoffs attribute with vscode target shows description', async () => {
            const content = [
                '---',
                'description: "Test"',
                'target: vscode',
                'handoffs:',
                '  - label: Test',
                '    agent: Default',
                '    prompt: Test',
                '---',
            ].join('\n');
            const hover = await getHover(content, 4, 1, PromptsType.agent);
            assert.strictEqual(hover, 'Possible handoff actions when the agent has completed its task.');
        });
        test('hover on github-copilot tool shows simple description', async () => {
            const content = [
                '---',
                'description: "Test"',
                'target: github-copilot',
                `tools: ['shell', 'edit', 'search']`,
                '---',
            ].join('\n');
            // Hover on 'shell' tool
            const hoverShell = await getHover(content, 4, 10, PromptsType.agent);
            assert.strictEqual(hoverShell, 'Execute shell commands');
            // Hover on 'edit' tool
            const hoverEdit = await getHover(content, 4, 20, PromptsType.agent);
            assert.strictEqual(hoverEdit, 'Edit files');
            // Hover on 'search' tool
            const hoverSearch = await getHover(content, 4, 28, PromptsType.agent);
            assert.strictEqual(hoverSearch, 'Search in files');
        });
        test('hover on github-copilot tool with target undefined', async () => {
            const content = [
                '---',
                'name: "Test"',
                'description: "Test"',
                `tools: ['shell', 'edit', 'search']`,
                '---',
            ].join('\n');
            // Hover on 'shell' tool
            const hoverShell = await getHover(content, 4, 10, PromptsType.agent);
            assert.strictEqual(hoverShell, 'ToolSet: execute\n\n\nExecute code and applications on your machine');
            // Hover on 'edit' tool
            const hoverEdit = await getHover(content, 4, 20, PromptsType.agent);
            assert.strictEqual(hoverEdit, 'Edit files');
            // Hover on 'search' tool
            const hoverSearch = await getHover(content, 4, 28, PromptsType.agent);
            assert.strictEqual(hoverSearch, 'Search in files');
        });
        test('hover on vscode tool shows detailed description', async () => {
            const content = [
                '---',
                'description: "Test"',
                'target: vscode',
                `tools: ['tool1', 'tool2']`,
                '---',
            ].join('\n');
            // Hover on 'tool1'
            const hover = await getHover(content, 4, 10, PromptsType.agent);
            assert.strictEqual(hover, 'Test Tool 1');
        });
        test('hover on description attribute', async () => {
            const content = [
                '---',
                'description: "Test agent"',
                'target: vscode',
                '---',
            ].join('\n');
            const hover = await getHover(content, 2, 1, PromptsType.agent);
            assert.strictEqual(hover, 'The description of the custom agent, what it does and when to use it.');
        });
        test('hover on argument-hint attribute', async () => {
            const content = [
                '---',
                'description: "Test"',
                'argument-hint: "test hint"',
                '---',
            ].join('\n');
            const hover = await getHover(content, 3, 1, PromptsType.agent);
            assert.strictEqual(hover, 'The argument-hint describes what inputs the custom agent expects or supports.');
        });
        test('hover on name attribute', async () => {
            const content = [
                '---',
                'name: "My Agent"',
                'description: "Test agent"',
                'target: vscode',
                '---',
            ].join('\n');
            const hover = await getHover(content, 2, 1, PromptsType.agent);
            assert.strictEqual(hover, 'The name of the agent as shown in the UI.');
        });
    });
    suite('prompt hovers', () => {
        test('hover on model attribute shows model info', async () => {
            const content = [
                '---',
                'description: "Test"',
                'model: MAE 4 (olama)',
                '---',
            ].join('\n');
            const hover = await getHover(content, 3, 1, PromptsType.prompt);
            const expected = [
                'The model to use in this prompt.',
                '',
                '- Name: MAE 4',
                '- Family: mae',
                '- Vendor: olama'
            ].join('\n');
            assert.strictEqual(hover, expected);
        });
        test('hover on tools attribute shows tool description', async () => {
            const content = [
                '---',
                'description: "Test"',
                `tools: ['tool1']`,
                '---',
            ].join('\n');
            const hover = await getHover(content, 3, 10, PromptsType.prompt);
            assert.strictEqual(hover, 'Test Tool 1');
        });
        test('hover on agent attribute shows agent info', async () => {
            const content = [
                '---',
                'description: "Test"',
                'agent: BeastMode',
                '---',
            ].join('\n');
            const hover = await getHover(content, 3, 1, PromptsType.prompt);
            const expected = [
                'The agent to use when running this prompt.',
                '',
                '**Built-in agents:**',
                '- `agent`: Describe what to build next',
                '- `ask`: Explore and understand your code',
                '- `edit`: Edit or refactor selected code',
                '',
                '**Custom agents:**',
                '- `BeastMode`: Custom agent'
            ].join('\n');
            assert.strictEqual(hover, expected);
        });
        test('hover on name attribute', async () => {
            const content = [
                '---',
                'name: "My Prompt"',
                'description: "Test prompt"',
                '---',
            ].join('\n');
            const hover = await getHover(content, 2, 1, PromptsType.prompt);
            assert.strictEqual(hover, 'The name of the prompt. This is also the name of the slash command that will run this prompt.');
        });
    });
    suite('instructions hovers', () => {
        test('hover on description attribute', async () => {
            const content = [
                '---',
                'description: "Test instruction"',
                'applyTo: "**/*.ts"',
                '---',
            ].join('\n');
            const hover = await getHover(content, 2, 1, PromptsType.instructions);
            assert.strictEqual(hover, 'The description of the instruction file. It can be used to provide additional context or information about the instructions and is passed to the language model as part of the prompt.');
        });
        test('hover on applyTo attribute', async () => {
            const content = [
                '---',
                'description: "Test"',
                'applyTo: "**/*.ts"',
                '---',
            ].join('\n');
            const hover = await getHover(content, 3, 1, PromptsType.instructions);
            const expected = [
                'One or more glob pattern (separated by comma) that describe for which files the instructions apply to. Based on these patterns, the file is automatically included in the prompt, when the context contains a file that matches one or more of these patterns. Use `**` when you want this file to always be added.',
                'Example: `**/*.ts`, `**/*.js`, `client/**`'
            ].join('\n');
            assert.strictEqual(hover, expected);
        });
        test('hover on name attribute', async () => {
            const content = [
                '---',
                'name: "My Instructions"',
                'description: "Test instruction"',
                'applyTo: "**/*.ts"',
                '---',
            ].join('\n');
            const hover = await getHover(content, 2, 1, PromptsType.instructions);
            assert.strictEqual(hover, 'The name of the instruction file as shown in the UI. If not set, the name is derived from the file name.');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0SG92ZXJzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2Jyb3dzZXIvcHJvbXB0U3l0bnRheC9wcm9tcHRIb3ZlcnMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDbEYsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9FQUFvRSxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGtGQUFrRixDQUFDO0FBQzVILE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRWpHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDMUYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSwwQkFBMEIsRUFBYSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNySCxPQUFPLEVBQThCLHNCQUFzQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdkcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0VBQWdFLENB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