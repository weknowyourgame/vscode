/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { mockObject } from '../../../../../base/test/common/mock.js';
import { assertSnapshot } from '../../../../../base/test/common/snapshot.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IExtensionService, nullExtensionDescription } from '../../../../services/extensions/common/extensions.js';
import { TestExtensionService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { ChatAgentService, IChatAgentService } from '../../common/chatAgents.js';
import { ChatRequestParser } from '../../common/chatRequestParser.js';
import { IChatService } from '../../common/chatService.js';
import { IChatSlashCommandService } from '../../common/chatSlashCommands.js';
import { LocalChatSessionUri } from '../../common/chatUri.js';
import { IChatVariablesService } from '../../common/chatVariables.js';
import { ChatAgentLocation, ChatModeKind } from '../../common/constants.js';
import { ToolDataSource } from '../../common/languageModelToolsService.js';
import { IPromptsService } from '../../common/promptSyntax/service/promptsService.js';
import { MockChatService } from './mockChatService.js';
import { MockChatVariablesService } from './mockChatVariables.js';
import { MockPromptsService } from './mockPromptsService.js';
const testSessionUri = LocalChatSessionUri.forSession('test-session');
suite('ChatRequestParser', () => {
    const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let parser;
    let variableService;
    setup(async () => {
        instantiationService = testDisposables.add(new TestInstantiationService());
        instantiationService.stub(IStorageService, testDisposables.add(new TestStorageService()));
        instantiationService.stub(ILogService, new NullLogService());
        instantiationService.stub(IExtensionService, new TestExtensionService());
        instantiationService.stub(IChatService, new MockChatService());
        instantiationService.stub(IContextKeyService, new MockContextKeyService());
        instantiationService.stub(IChatAgentService, testDisposables.add(instantiationService.createInstance(ChatAgentService)));
        instantiationService.stub(IPromptsService, testDisposables.add(new MockPromptsService()));
        variableService = new MockChatVariablesService();
        instantiationService.stub(IChatVariablesService, variableService);
    });
    test('plain text', async () => {
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, 'test');
        await assertSnapshot(result);
    });
    test('plain text with newlines', async () => {
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = 'line 1\nline 2\r\nline 3';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('slash in text', async () => {
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = 'can we add a new file for an Express router to handle the / route';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('slash command', async () => {
        const slashCommandService = mockObject()({});
        slashCommandService.getCommands.returns([{ command: 'fix' }]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatSlashCommandService, slashCommandService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = '/fix this';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('invalid slash command', async () => {
        const slashCommandService = mockObject()({});
        slashCommandService.getCommands.returns([{ command: 'fix' }]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatSlashCommandService, slashCommandService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = '/explain this';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('multiple slash commands', async () => {
        const slashCommandService = mockObject()({});
        slashCommandService.getCommands.returns([{ command: 'fix' }]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatSlashCommandService, slashCommandService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = '/fix /fix';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('slash command not first', async () => {
        const slashCommandService = mockObject()({});
        slashCommandService.getCommands.returns([{ command: 'fix' }]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatSlashCommandService, slashCommandService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = 'Hello /fix';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('slash command after whitespace', async () => {
        const slashCommandService = mockObject()({});
        slashCommandService.getCommands.returns([{ command: 'fix' }]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatSlashCommandService, slashCommandService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = '    /fix';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('prompt slash command', async () => {
        const slashCommandService = mockObject()({});
        slashCommandService.getCommands.returns([{ command: 'fix' }]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatSlashCommandService, slashCommandService);
        const promptSlashCommandService = mockObject()({});
        promptSlashCommandService.isValidSlashCommandName.callsFake((command) => {
            return !!command.match(/^[\w_\-\.]+$/);
        });
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IPromptsService, promptSlashCommandService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = '    /prompt';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('prompt slash command after text', async () => {
        const slashCommandService = mockObject()({});
        slashCommandService.getCommands.returns([{ command: 'fix' }]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatSlashCommandService, slashCommandService);
        const promptSlashCommandService = mockObject()({});
        promptSlashCommandService.isValidSlashCommandName.callsFake((command) => {
            return !!command.match(/^[\w_\-\.]+$/);
        });
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IPromptsService, promptSlashCommandService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = 'handle the / route and the request of /search-option';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('prompt slash command after slash', async () => {
        const slashCommandService = mockObject()({});
        slashCommandService.getCommands.returns([{ command: 'fix' }]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatSlashCommandService, slashCommandService);
        const promptSlashCommandService = mockObject()({});
        promptSlashCommandService.isValidSlashCommandName.callsFake((command) => {
            return !!command.match(/^[\w_\-\.]+$/);
        });
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IPromptsService, promptSlashCommandService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = '/ route and the request of /search-option';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    test('prompt slash command with numbers', async () => {
        const slashCommandService = mockObject()({});
        slashCommandService.getCommands.returns([{ command: 'fix' }]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatSlashCommandService, slashCommandService);
        const promptSlashCommandService = mockObject()({});
        promptSlashCommandService.isValidSlashCommandName.callsFake((command) => {
            return !!command.match(/^[\w_\-\.]+$/);
        });
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IPromptsService, promptSlashCommandService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const text = '/001-sample this is a test';
        const result = parser.parseChatRequest(testSessionUri, text);
        await assertSnapshot(result);
    });
    // test('variables', async () => {
    // 	varService.hasVariable.returns(true);
    // 	varService.getVariable.returns({ id: 'copilot.selection' });
    // 	parser = instantiationService.createInstance(ChatRequestParser);
    // 	const text = 'What does #selection mean?';
    // 	const result = parser.parseChatRequest(testSessionUri, text);
    // 	await assertSnapshot(result);
    // });
    // test('variable with question mark', async () => {
    // 	varService.hasVariable.returns(true);
    // 	varService.getVariable.returns({ id: 'copilot.selection' });
    // 	parser = instantiationService.createInstance(ChatRequestParser);
    // 	const text = 'What is #selection?';
    // 	const result = parser.parseChatRequest(testSessionUri, text);
    // 	await assertSnapshot(result);
    // });
    // test('invalid variables', async () => {
    // 	varService.hasVariable.returns(false);
    // 	parser = instantiationService.createInstance(ChatRequestParser);
    // 	const text = 'What does #selection mean?';
    // 	const result = parser.parseChatRequest(testSessionUri, text);
    // 	await assertSnapshot(result);
    // });
    const getAgentWithSlashCommands = (slashCommands) => {
        return { id: 'agent', name: 'agent', extensionId: nullExtensionDescription.identifier, extensionVersion: undefined, publisherDisplayName: '', extensionDisplayName: '', extensionPublisherId: '', locations: [ChatAgentLocation.Chat], modes: [ChatModeKind.Ask], metadata: {}, slashCommands, disambiguation: [] };
    };
    test('agent with subcommand after text', async () => {
        const agentsService = mockObject()({});
        agentsService.getAgentsByName.returns([getAgentWithSlashCommands([{ name: 'subCommand', description: '' }])]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatAgentService, agentsService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, '@agent Please do /subCommand thanks');
        await assertSnapshot(result);
    });
    test('agents, subCommand', async () => {
        const agentsService = mockObject()({});
        agentsService.getAgentsByName.returns([getAgentWithSlashCommands([{ name: 'subCommand', description: '' }])]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatAgentService, agentsService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, '@agent /subCommand Please do thanks');
        await assertSnapshot(result);
    });
    test('agent but edit mode', async () => {
        const agentsService = mockObject()({});
        agentsService.getAgentsByName.returns([getAgentWithSlashCommands([])]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatAgentService, agentsService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, '@agent hello', undefined, { mode: ChatModeKind.Edit });
        await assertSnapshot(result);
    });
    test('agent with question mark', async () => {
        const agentsService = mockObject()({});
        agentsService.getAgentsByName.returns([getAgentWithSlashCommands([{ name: 'subCommand', description: '' }])]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatAgentService, agentsService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, '@agent? Are you there');
        await assertSnapshot(result);
    });
    test('agent and subcommand with leading whitespace', async () => {
        const agentsService = mockObject()({});
        agentsService.getAgentsByName.returns([getAgentWithSlashCommands([{ name: 'subCommand', description: '' }])]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatAgentService, agentsService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, '    \r\n\t   @agent \r\n\t   /subCommand Thanks');
        await assertSnapshot(result);
    });
    test('agent and subcommand after newline', async () => {
        const agentsService = mockObject()({});
        agentsService.getAgentsByName.returns([getAgentWithSlashCommands([{ name: 'subCommand', description: '' }])]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatAgentService, agentsService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, '    \n@agent\n/subCommand Thanks');
        await assertSnapshot(result);
    });
    test('agent not first', async () => {
        const agentsService = mockObject()({});
        agentsService.getAgentsByName.returns([getAgentWithSlashCommands([{ name: 'subCommand', description: '' }])]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatAgentService, agentsService);
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, 'Hello Mr. @agent');
        await assertSnapshot(result);
    });
    test('agents and tools and multiline', async () => {
        const agentsService = mockObject()({});
        agentsService.getAgentsByName.returns([getAgentWithSlashCommands([{ name: 'subCommand', description: '' }])]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatAgentService, agentsService);
        variableService.setSelectedToolAndToolSets(testSessionUri, new Map([
            [{ id: 'get_selection', toolReferenceName: 'selection', canBeReferencedInPrompt: true, displayName: '', modelDescription: '', source: ToolDataSource.Internal }, true],
            [{ id: 'get_debugConsole', toolReferenceName: 'debugConsole', canBeReferencedInPrompt: true, displayName: '', modelDescription: '', source: ToolDataSource.Internal }, true]
        ]));
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, '@agent /subCommand \nPlease do with #selection\nand #debugConsole');
        await assertSnapshot(result);
    });
    test('agents and tools and multiline, part2', async () => {
        const agentsService = mockObject()({});
        agentsService.getAgentsByName.returns([getAgentWithSlashCommands([{ name: 'subCommand', description: '' }])]);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IChatAgentService, agentsService);
        variableService.setSelectedToolAndToolSets(testSessionUri, new Map([
            [{ id: 'get_selection', toolReferenceName: 'selection', canBeReferencedInPrompt: true, displayName: '', modelDescription: '', source: ToolDataSource.Internal }, true],
            [{ id: 'get_debugConsole', toolReferenceName: 'debugConsole', canBeReferencedInPrompt: true, displayName: '', modelDescription: '', source: ToolDataSource.Internal }, true]
        ]));
        parser = instantiationService.createInstance(ChatRequestParser);
        const result = parser.parseChatRequest(testSessionUri, '@agent Please \ndo /subCommand with #selection\nand #debugConsole');
        await assertSnapshot(result);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFJlcXVlc3RQYXJzZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL2NoYXRSZXF1ZXN0UGFyc2VyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN6SCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUNoSCxPQUFPLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNwRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNuSCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQXFDLGlCQUFpQixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDcEgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzNELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxtQkFBbUIs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