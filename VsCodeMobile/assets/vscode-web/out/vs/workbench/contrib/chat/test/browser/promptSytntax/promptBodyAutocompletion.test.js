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
import { ChatConfiguration } from '../../../common/constants.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../../common/languageModelToolsService.js';
import { PromptBodyAutocompletion } from '../../../common/promptSyntax/languageProviders/promptBodyAutocompletion.js';
import { createTextModel } from '../../../../../../editor/test/common/testTextModel.js';
import { URI } from '../../../../../../base/common/uri.js';
import { getLanguageIdForPromptsType, PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { getPromptFileExtension } from '../../../common/promptSyntax/config/promptFileLocations.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { FileService } from '../../../../../../platform/files/common/fileService.js';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { InMemoryFileSystemProvider } from '../../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { ILogService, NullLogService } from '../../../../../../platform/log/common/log.js';
import { Range } from '../../../../../../editor/common/core/range.js';
suite('PromptBodyAutocompletion', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instaService;
    let completionProvider;
    setup(async () => {
        const testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration(ChatConfiguration.ExtensionToolsEnabled, true);
        instaService = workbenchInstantiationService({
            contextKeyService: () => disposables.add(new ContextKeyService(testConfigService)),
            configurationService: () => testConfigService
        }, disposables);
        instaService.stub(ILogService, new NullLogService());
        const fileService = disposables.add(instaService.createInstance(FileService));
        instaService.stub(IFileService, fileService);
        const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
        disposables.add(fileService.registerProvider('test', fileSystemProvider));
        // Create some test files and directories
        await fileService.createFolder(URI.parse('test:///workspace'));
        await fileService.createFolder(URI.parse('test:///workspace/src'));
        await fileService.createFolder(URI.parse('test:///workspace/docs'));
        await fileService.writeFile(URI.parse('test:///workspace/src/index.ts'), VSBuffer.fromString('export function hello() {}'));
        await fileService.writeFile(URI.parse('test:///workspace/README.md'), VSBuffer.fromString('# Project'));
        await fileService.writeFile(URI.parse('test:///workspace/package.json'), VSBuffer.fromString('{}'));
        const toolService = disposables.add(instaService.createInstance(LanguageModelToolsService));
        const testTool1 = { id: 'testTool1', displayName: 'tool1', canBeReferencedInPrompt: true, modelDescription: 'Test Tool 1', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(testTool1));
        const testTool2 = { id: 'testTool2', displayName: 'tool2', canBeReferencedInPrompt: true, toolReferenceName: 'tool2', modelDescription: 'Test Tool 2', source: ToolDataSource.External, inputSchema: {} };
        disposables.add(toolService.registerToolData(testTool2));
        const myExtSource = { type: 'extension', label: 'My Extension', extensionId: new ExtensionIdentifier('My.extension') };
        const testTool3 = { id: 'testTool3', displayName: 'tool3', canBeReferencedInPrompt: true, toolReferenceName: 'tool3', modelDescription: 'Test Tool 3', source: myExtSource, inputSchema: {} };
        disposables.add(toolService.registerToolData(testTool3));
        const prExtSource = { type: 'extension', label: 'GitHub Pull Request Extension', extensionId: new ExtensionIdentifier('github.vscode-pull-request-github') };
        const prExtTool1 = { id: 'suggestFix', canBeReferencedInPrompt: true, toolReferenceName: 'suggest-fix', modelDescription: 'tool4', displayName: 'Test Tool 4', source: prExtSource, inputSchema: {} };
        disposables.add(toolService.registerToolData(prExtTool1));
        instaService.set(ILanguageModelToolsService, toolService);
        completionProvider = instaService.createInstance(PromptBodyAutocompletion);
    });
    async function getCompletions(content, line, column, promptType) {
        const languageId = getLanguageIdForPromptsType(promptType);
        const model = disposables.add(createTextModel(content, languageId, undefined, URI.parse('test://workspace/test' + getPromptFileExtension(promptType))));
        const position = new Position(line, column);
        const context = { triggerKind: 0 /* CompletionTriggerKind.Invoke */ };
        const result = await completionProvider.provideCompletionItems(model, position, context, CancellationToken.None);
        if (!result || !result.suggestions) {
            return [];
        }
        const lineContent = model.getLineContent(position.lineNumber);
        return result.suggestions.map(s => {
            assert(s.range instanceof Range);
            return {
                label: s.label,
                result: lineContent.substring(0, s.range.startColumn - 1) + s.insertText + lineContent.substring(s.range.endColumn - 1)
            };
        });
    }
    suite('prompt body completions', () => {
        test('default suggestions', async () => {
            const content = [
                '---',
                'description: "Test"',
                '---',
                '',
                'Use # to reference a file or tool.',
                'One more #to'
            ].join('\n');
            {
                const actual = (await getCompletions(content, 5, 6, PromptsType.prompt));
                assert.deepEqual(actual, [
                    {
                        label: 'file:',
                        result: 'Use #file: to reference a file or tool.'
                    },
                    {
                        label: 'tool:',
                        result: 'Use #tool: to reference a file or tool.'
                    }
                ]);
            }
            {
                const actual = (await getCompletions(content, 6, 13, PromptsType.prompt));
                assert.deepEqual(actual, [
                    {
                        label: 'file:',
                        result: 'One more #file:'
                    },
                    {
                        label: 'tool:',
                        result: 'One more #tool:'
                    }
                ]);
            }
        });
        test('tool suggestions', async () => {
            const content = [
                '---',
                'description: "Test"',
                '---',
                '',
                'Use #tool: to reference a tool.',
            ].join('\n');
            {
                const actual = (await getCompletions(content, 5, 11, PromptsType.prompt));
                assert.deepEqual(actual, [
                    {
                        label: 'vscode',
                        result: 'Use #tool:vscode to reference a tool.'
                    },
                    {
                        label: 'execute',
                        result: 'Use #tool:execute to reference a tool.'
                    },
                    {
                        label: 'read',
                        result: 'Use #tool:read to reference a tool.'
                    },
                    {
                        label: 'tool1',
                        result: 'Use #tool:tool1 to reference a tool.'
                    },
                    {
                        label: 'tool2',
                        result: 'Use #tool:tool2 to reference a tool.'
                    },
                    {
                        label: 'my.extension/tool3',
                        result: 'Use #tool:my.extension/tool3 to reference a tool.'
                    },
                    {
                        label: 'github.vscode-pull-request-github/suggest-fix',
                        result: 'Use #tool:github.vscode-pull-request-github/suggest-fix to reference a tool.'
                    }
                ]);
            }
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0Qm9keUF1dG9jb21wbGV0aW9uLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2Jyb3dzZXIvcHJvbXB0U3l0bnRheC9wcm9tcHRCb2R5QXV0b2NvbXBsZXRpb24udGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDbEYsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRTVFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9FQUFvRSxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGtGQUFrRixDQUFDO0FBQzVILE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRWpHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSwwQkFBMEIsRUFBYSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNySCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw0RUFBNEUsQ0FBQztBQUN0SCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDeEYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNELE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxXQUFXLEVBQUUsTUFB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