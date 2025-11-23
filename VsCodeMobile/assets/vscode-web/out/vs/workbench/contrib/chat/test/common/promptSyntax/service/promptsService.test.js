/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import * as sinon from 'sinon';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';
import { ResourceSet } from '../../../../../../../base/common/map.js';
import { Schemas } from '../../../../../../../base/common/network.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../../../../editor/common/services/model.js';
import { ModelService } from '../../../../../../../editor/common/services/modelService.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IFileService } from '../../../../../../../platform/files/common/files.js';
import { FileService } from '../../../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { TestInstantiationService } from '../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILabelService } from '../../../../../../../platform/label/common/label.js';
import { ILogService, NullLogService } from '../../../../../../../platform/log/common/log.js';
import { ITelemetryService } from '../../../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../../../../../platform/telemetry/common/telemetryUtils.js';
import { IWorkspaceContextService } from '../../../../../../../platform/workspace/common/workspace.js';
import { testWorkspace } from '../../../../../../../platform/workspace/test/common/testWorkspace.js';
import { IWorkbenchEnvironmentService } from '../../../../../../services/environment/common/environmentService.js';
import { IFilesConfigurationService } from '../../../../../../services/filesConfiguration/common/filesConfigurationService.js';
import { IUserDataProfileService } from '../../../../../../services/userDataProfile/common/userDataProfile.js';
import { TestContextService, TestUserDataProfileService } from '../../../../../../test/common/workbenchTestServices.js';
import { ChatRequestVariableSet, isPromptFileVariableEntry, toFileVariableEntry } from '../../../../common/chatVariableEntries.js';
import { ComputeAutomaticInstructions, newInstructionsCollectionEvent } from '../../../../common/promptSyntax/computeAutomaticInstructions.js';
import { PromptsConfig } from '../../../../common/promptSyntax/config/config.js';
import { INSTRUCTION_FILE_EXTENSION, INSTRUCTIONS_DEFAULT_SOURCE_FOLDER, LEGACY_MODE_DEFAULT_SOURCE_FOLDER, PROMPT_DEFAULT_SOURCE_FOLDER, PROMPT_FILE_EXTENSION } from '../../../../common/promptSyntax/config/promptFileLocations.js';
import { INSTRUCTIONS_LANGUAGE_ID, PROMPT_LANGUAGE_ID, PromptsType } from '../../../../common/promptSyntax/promptTypes.js';
import { IPromptsService, PromptsStorage } from '../../../../common/promptSyntax/service/promptsService.js';
import { PromptsService } from '../../../../common/promptSyntax/service/promptsServiceImpl.js';
import { mockFiles } from '../testUtils/mockFilesystem.js';
import { InMemoryStorageService, IStorageService } from '../../../../../../../platform/storage/common/storage.js';
import { IPathService } from '../../../../../../services/path/common/pathService.js';
import { ISearchService } from '../../../../../../services/search/common/search.js';
suite('PromptsService', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let service;
    let instaService;
    let workspaceContextService;
    let testConfigService;
    let fileService;
    setup(async () => {
        instaService = disposables.add(new TestInstantiationService());
        instaService.stub(ILogService, new NullLogService());
        workspaceContextService = new TestContextService();
        instaService.stub(IWorkspaceContextService, workspaceContextService);
        testConfigService = new TestConfigurationService();
        testConfigService.setUserConfiguration(PromptsConfig.USE_COPILOT_INSTRUCTION_FILES, true);
        testConfigService.setUserConfiguration(PromptsConfig.USE_AGENT_MD, true);
        testConfigService.setUserConfiguration(PromptsConfig.USE_NESTED_AGENT_MD, false);
        testConfigService.setUserConfiguration(PromptsConfig.INSTRUCTIONS_LOCATION_KEY, { [INSTRUCTIONS_DEFAULT_SOURCE_FOLDER]: true });
        testConfigService.setUserConfiguration(PromptsConfig.PROMPT_LOCATIONS_KEY, { [PROMPT_DEFAULT_SOURCE_FOLDER]: true });
        testConfigService.setUserConfiguration(PromptsConfig.MODE_LOCATION_KEY, { [LEGACY_MODE_DEFAULT_SOURCE_FOLDER]: true });
        instaService.stub(IConfigurationService, testConfigService);
        instaService.stub(IWorkbenchEnvironmentService, {});
        instaService.stub(IUserDataProfileService, new TestUserDataProfileService());
        instaService.stub(ITelemetryService, NullTelemetryService);
        instaService.stub(IStorageService, InMemoryStorageService);
        fileService = disposables.add(instaService.createInstance(FileService));
        instaService.stub(IFileService, fileService);
        const modelService = disposables.add(instaService.createInstance(ModelService));
        instaService.stub(IModelService, modelService);
        instaService.stub(ILanguageService, {
            guessLanguageIdByFilepathOrFirstLine(uri) {
                if (uri.path.endsWith(PROMPT_FILE_EXTENSION)) {
                    return PROMPT_LANGUAGE_ID;
                }
                if (uri.path.endsWith(INSTRUCTION_FILE_EXTENSION)) {
                    return INSTRUCTIONS_LANGUAGE_ID;
                }
                return 'plaintext';
            }
        });
        instaService.stub(ILabelService, { getUriLabel: (uri) => uri.path });
        const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
        disposables.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
        instaService.stub(IFilesConfigurationService, { updateReadonly: () => Promise.resolve() });
        const pathService = {
            userHome: () => {
                return Promise.resolve(URI.file('/home/user'));
            },
        };
        instaService.stub(IPathService, pathService);
        instaService.stub(ISearchService, {});
        service = disposables.add(instaService.createInstance(PromptsService));
        instaService.stub(IPromptsService, service);
    });
    suite('parse', () => {
        test('explicit', async function () {
            const rootFolderName = 'resolves-nested-file-references';
            const rootFolder = `/${rootFolderName}`;
            const rootFileName = 'file2.prompt.md';
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            const rootFileUri = URI.joinPath(rootFolderUri, rootFileName);
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/file1.prompt.md`,
                    contents: [
                        '## Some Header',
                        'some contents',
                        ' ',
                    ],
                },
                {
                    path: `${rootFolder}/${rootFileName}`,
                    contents: [
                        '---',
                        'description: \'Root prompt description.\'',
                        'tools: [\'my-tool1\', , true]',
                        'agent: "agent" ',
                        '---',
                        '## Files',
                        '\t- this file #file:folder1/file3.prompt.md ',
                        '\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!',
                        '## Vars',
                        '\t- #tool:my-tool',
                        '\t- #tool:my-other-tool',
                        ' ',
                    ],
                },
                {
                    path: `${rootFolder}/folder1/file3.prompt.md`,
                    contents: [
                        '---',
                        'tools: [ false, \'my-tool1\' , ]',
                        'agent: \'edit\'',
                        '---',
                        '',
                        '[](./some-other-folder/non-existing-folder)',
                        `\t- some seemingly random #file:${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.instructions.md contents`,
                        ' some more\t content',
                    ],
                },
                {
                    path: `${rootFolder}/folder1/some-other-folder/file4.prompt.md`,
                    contents: [
                        '---',
                        'tools: [\'my-tool1\', "my-tool2", true, , ]',
                        'something: true',
                        'agent: \'ask\'\t',
                        'description: "File 4 splendid description."',
                        '---',
                        'this file has a non-existing #file:./some-non-existing/file.prompt.md\t\treference',
                        '',
                        '',
                        'and some',
                        ' non-prompt #file:./some-non-prompt-file.md\t\t \t[](../../folder1/)\t',
                    ],
                },
                {
                    path: `${rootFolder}/folder1/some-other-folder/file.txt`,
                    contents: [
                        '---',
                        'description: "Non-prompt file description".',
                        'tools: ["my-tool-24"]',
                        '---',
                    ],
                },
                {
                    path: `${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.instructions.md`,
                    contents: [
                        '---',
                        'description: "Another file description."',
                        'tools: [\'my-tool3\', false, "my-tool2" ]',
                        'applyTo: "**/*.tsx"',
                        '---',
                        `[](${rootFolder}/folder1/some-other-folder)`,
                        'another-file.instructions.md contents\t [#file:file.txt](../file.txt)',
                    ],
                },
                {
                    path: `${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/one_more_file_just_in_case.prompt.md`,
                    contents: ['one_more_file_just_in_case.prompt.md contents'],
                },
            ]);
            const file3 = URI.joinPath(rootFolderUri, 'folder1/file3.prompt.md');
            const file4 = URI.joinPath(rootFolderUri, 'folder1/some-other-folder/file4.prompt.md');
            const someOtherFolder = URI.joinPath(rootFolderUri, '/folder1/some-other-folder');
            const someOtherFolderFile = URI.joinPath(rootFolderUri, '/folder1/some-other-folder/file.txt');
            const nonExistingFolder = URI.joinPath(rootFolderUri, 'folder1/some-other-folder/non-existing-folder');
            const yetAnotherFile = URI.joinPath(rootFolderUri, 'folder1/some-other-folder/yetAnotherFolder🤭/another-file.instructions.md');
            const result1 = await service.parseNew(rootFileUri, CancellationToken.None);
            assert.deepEqual(result1.uri, rootFileUri);
            assert.deepEqual(result1.header?.description, 'Root prompt description.');
            assert.deepEqual(result1.header?.tools, ['my-tool1']);
            assert.deepEqual(result1.header?.agent, 'agent');
            assert.ok(result1.body);
            assert.deepEqual(result1.body.fileReferences.map(r => result1.body?.resolveFilePath(r.content)), [file3, file4]);
            assert.deepEqual(result1.body.variableReferences, [
                { name: 'my-tool', range: new Range(10, 10, 10, 17), offset: 240 },
                { name: 'my-other-tool', range: new Range(11, 10, 11, 23), offset: 257 },
            ]);
            const result2 = await service.parseNew(file3, CancellationToken.None);
            assert.deepEqual(result2.uri, file3);
            assert.deepEqual(result2.header?.agent, 'edit');
            assert.ok(result2.body);
            assert.deepEqual(result2.body.fileReferences.map(r => result2.body?.resolveFilePath(r.content)), [nonExistingFolder, yetAnotherFile]);
            const result3 = await service.parseNew(yetAnotherFile, CancellationToken.None);
            assert.deepEqual(result3.uri, yetAnotherFile);
            assert.deepEqual(result3.header?.description, 'Another file description.');
            assert.deepEqual(result3.header?.applyTo, '**/*.tsx');
            assert.ok(result3.body);
            assert.deepEqual(result3.body.fileReferences.map(r => result3.body?.resolveFilePath(r.content)), [someOtherFolder, someOtherFolderFile]);
            assert.deepEqual(result3.body.variableReferences, []);
            const result4 = await service.parseNew(file4, CancellationToken.None);
            assert.deepEqual(result4.uri, file4);
            assert.deepEqual(result4.header?.description, 'File 4 splendid description.');
            assert.ok(result4.body);
            assert.deepEqual(result4.body.fileReferences.map(r => result4.body?.resolveFilePath(r.content)), [
                URI.joinPath(rootFolderUri, '/folder1/some-other-folder/some-non-existing/file.prompt.md'),
                URI.joinPath(rootFolderUri, '/folder1/some-other-folder/some-non-prompt-file.md'),
                URI.joinPath(rootFolderUri, '/folder1/'),
            ]);
            assert.deepEqual(result4.body.variableReferences, []);
        });
    });
    suite('findInstructionFilesFor', () => {
        teardown(() => {
            sinon.restore();
        });
        test('finds correct instruction files', async () => {
            const rootFolderName = 'finds-instruction-files';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            const userPromptsFolderName = '/tmp/user-data/prompts';
            const userPromptsFolderUri = URI.file(userPromptsFolderName);
            sinon.stub(service, 'listPromptFiles')
                .returns(Promise.resolve([
                // local instructions
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file1.instructions.md'),
                    storage: PromptsStorage.local,
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file2.instructions.md'),
                    storage: PromptsStorage.local,
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file3.instructions.md'),
                    storage: PromptsStorage.local,
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file4.instructions.md'),
                    storage: PromptsStorage.local,
                    type: PromptsType.instructions,
                },
                // user instructions
                {
                    uri: URI.joinPath(userPromptsFolderUri, 'file10.instructions.md'),
                    storage: PromptsStorage.user,
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(userPromptsFolderUri, 'file11.instructions.md'),
                    storage: PromptsStorage.user,
                    type: PromptsType.instructions,
                },
            ]));
            // mock current workspace file structure
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/file1.prompt.md`,
                    contents: [
                        '## Some Header',
                        'some contents',
                        ' ',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file1.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 1.\'',
                        'applyTo: "**/*.tsx"',
                        '---',
                        'Some instructions 1 contents.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file2.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 2.\'',
                        'applyTo: "**/folder1/*.tsx"',
                        '---',
                        'Some instructions 2 contents.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file3.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 3.\'',
                        'applyTo: "**/folder2/*.tsx"',
                        '---',
                        'Some instructions 3 contents.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file4.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 4.\'',
                        'applyTo: "src/build/*.tsx"',
                        '---',
                        'Some instructions 4 contents.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file5.prompt.md`,
                    contents: [
                        '---',
                        'description: \'Prompt file 5.\'',
                        '---',
                        'Some prompt 5 contents.',
                    ]
                },
                {
                    path: `${rootFolder}/folder1/main.tsx`,
                    contents: [
                        'console.log("Haalou!")'
                    ]
                }
            ]);
            // mock user data instructions
            await mockFiles(fileService, [
                {
                    path: `${userPromptsFolderName}/file10.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 10.\'',
                        'applyTo: "**/folder1/*.tsx"',
                        '---',
                        'Some instructions 10 contents.',
                    ]
                },
                {
                    path: `${userPromptsFolderName}/file11.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 11.\'',
                        'applyTo: "**/folder1/*.py"',
                        '---',
                        'Some instructions 11 contents.',
                    ]
                },
                {
                    path: `${userPromptsFolderName}/file12.prompt.md`,
                    contents: [
                        '---',
                        'description: \'Prompt file 12.\'',
                        '---',
                        'Some prompt 12 contents.',
                    ]
                }
            ]);
            const instructionFiles = await service.listPromptFiles(PromptsType.instructions, CancellationToken.None);
            const contextComputer = instaService.createInstance(ComputeAutomaticInstructions, undefined);
            const context = {
                files: new ResourceSet([
                    URI.joinPath(rootFolderUri, 'folder1/main.tsx'),
                ]),
                instructions: new ResourceSet(),
            };
            const result = new ChatRequestVariableSet();
            await contextComputer.addApplyingInstructions(instructionFiles, context, result, newInstructionsCollectionEvent(), CancellationToken.None);
            assert.deepStrictEqual(result.asArray().map(i => isPromptFileVariableEntry(i) ? i.value.path : undefined), [
                // local instructions
                URI.joinPath(rootFolderUri, '.github/prompts/file1.instructions.md').path,
                URI.joinPath(rootFolderUri, '.github/prompts/file2.instructions.md').path,
                // user instructions
                URI.joinPath(userPromptsFolderUri, 'file10.instructions.md').path,
            ], 'Must find correct instruction files.');
        });
        test('does not have duplicates', async () => {
            const rootFolderName = 'finds-instruction-files-without-duplicates';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            const userPromptsFolderName = '/tmp/user-data/prompts';
            const userPromptsFolderUri = URI.file(userPromptsFolderName);
            sinon.stub(service, 'listPromptFiles')
                .returns(Promise.resolve([
                // local instructions
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file1.instructions.md'),
                    storage: PromptsStorage.local,
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file2.instructions.md'),
                    storage: PromptsStorage.local,
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file3.instructions.md'),
                    storage: PromptsStorage.local,
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(rootFolderUri, '.github/prompts/file4.instructions.md'),
                    storage: PromptsStorage.local,
                    type: PromptsType.instructions,
                },
                // user instructions
                {
                    uri: URI.joinPath(userPromptsFolderUri, 'file10.instructions.md'),
                    storage: PromptsStorage.user,
                    type: PromptsType.instructions,
                },
                {
                    uri: URI.joinPath(userPromptsFolderUri, 'file11.instructions.md'),
                    storage: PromptsStorage.user,
                    type: PromptsType.instructions,
                },
            ]));
            // mock current workspace file structure
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/file1.prompt.md`,
                    contents: [
                        '## Some Header',
                        'some contents',
                        ' ',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file1.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 1.\'',
                        'applyTo: "**/*.tsx"',
                        '---',
                        'Some instructions 1 contents.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file2.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 2.\'',
                        'applyTo: "**/folder1/*.tsx"',
                        '---',
                        'Some instructions 2 contents. [](./file1.instructions.md)',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file3.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 3.\'',
                        'applyTo: "**/folder2/*.tsx"',
                        '---',
                        'Some instructions 3 contents.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file4.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 4.\'',
                        'applyTo: "src/build/*.tsx"',
                        '---',
                        '[](./file3.instructions.md) Some instructions 4 contents.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/prompts/file5.prompt.md`,
                    contents: [
                        '---',
                        'description: \'Prompt file 5.\'',
                        '---',
                        'Some prompt 5 contents.',
                    ]
                },
                {
                    path: `${rootFolder}/folder1/main.tsx`,
                    contents: [
                        'console.log("Haalou!")'
                    ]
                }
            ]);
            // mock user data instructions
            await mockFiles(fileService, [
                {
                    path: `${userPromptsFolderName}/file10.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 10.\'',
                        'applyTo: "**/folder1/*.tsx"',
                        '---',
                        'Some instructions 10 contents.',
                    ]
                },
                {
                    path: `${userPromptsFolderName}/file11.instructions.md`,
                    contents: [
                        '---',
                        'description: \'Instructions file 11.\'',
                        'applyTo: "**/folder1/*.py"',
                        '---',
                        'Some instructions 11 contents.',
                    ]
                },
                {
                    path: `${userPromptsFolderName}/file12.prompt.md`,
                    contents: [
                        '---',
                        'description: \'Prompt file 12.\'',
                        '---',
                        'Some prompt 12 contents.',
                    ]
                }
            ]);
            const instructionFiles = await service.listPromptFiles(PromptsType.instructions, CancellationToken.None);
            const contextComputer = instaService.createInstance(ComputeAutomaticInstructions, undefined);
            const context = {
                files: new ResourceSet([
                    URI.joinPath(rootFolderUri, 'folder1/main.tsx'),
                    URI.joinPath(rootFolderUri, 'folder1/index.tsx'),
                    URI.joinPath(rootFolderUri, 'folder1/constants.tsx'),
                ]),
                instructions: new ResourceSet(),
            };
            const result = new ChatRequestVariableSet();
            await contextComputer.addApplyingInstructions(instructionFiles, context, result, newInstructionsCollectionEvent(), CancellationToken.None);
            assert.deepStrictEqual(result.asArray().map(i => isPromptFileVariableEntry(i) ? i.value.path : undefined), [
                // local instructions
                URI.joinPath(rootFolderUri, '.github/prompts/file1.instructions.md').path,
                URI.joinPath(rootFolderUri, '.github/prompts/file2.instructions.md').path,
                // user instructions
                URI.joinPath(userPromptsFolderUri, 'file10.instructions.md').path,
            ], 'Must find correct instruction files.');
        });
        test('copilot-instructions and AGENTS.md', async () => {
            const rootFolderName = 'copilot-instructions-and-agents';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            // mock current workspace file structure
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/codestyle.md`,
                    contents: [
                        'Can you see this?',
                    ]
                },
                {
                    path: `${rootFolder}/AGENTS.md`,
                    contents: [
                        'What about this?',
                    ]
                },
                {
                    path: `${rootFolder}/README.md`,
                    contents: [
                        'Thats my project?',
                    ]
                },
                {
                    path: `${rootFolder}/.github/copilot-instructions.md`,
                    contents: [
                        'Be nice and friendly. Also look at instructions at #file:../codestyle.md and [more-codestyle.md](./more-codestyle.md).',
                    ]
                },
                {
                    path: `${rootFolder}/.github/more-codestyle.md`,
                    contents: [
                        'I like it clean.',
                    ]
                },
                {
                    path: `${rootFolder}/folder1/AGENTS.md`,
                    contents: [
                        'An AGENTS.md file in another repo'
                    ]
                }
            ]);
            const contextComputer = instaService.createInstance(ComputeAutomaticInstructions, undefined);
            const context = new ChatRequestVariableSet();
            context.add(toFileVariableEntry(URI.joinPath(rootFolderUri, 'README.md')));
            await contextComputer.collect(context, CancellationToken.None);
            assert.deepStrictEqual(context.asArray().map(i => isPromptFileVariableEntry(i) ? i.value.path : undefined).filter(e => !!e).sort(), [
                URI.joinPath(rootFolderUri, '.github/copilot-instructions.md').path,
                URI.joinPath(rootFolderUri, '.github/more-codestyle.md').path,
                URI.joinPath(rootFolderUri, 'AGENTS.md').path,
                URI.joinPath(rootFolderUri, 'codestyle.md').path,
            ].sort(), 'Must find correct instruction files.');
        });
    });
    suite('getCustomAgents', () => {
        teardown(() => {
            sinon.restore();
        });
        test('header with handOffs', async () => {
            const rootFolderName = 'custom-agents-with-handoffs';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/.github/agents/agent1.agent.md`,
                    contents: [
                        '---',
                        'description: \'Agent file 1.\'',
                        'handoffs: [ { agent: "Edit", label: "Do it", prompt: "Do it now" } ]',
                        '---',
                    ]
                }
            ]);
            const result = (await service.getCustomAgents(CancellationToken.None)).map(agent => ({ ...agent, uri: URI.from(agent.uri) }));
            const expected = [
                {
                    name: 'agent1',
                    description: 'Agent file 1.',
                    handOffs: [{ agent: 'Edit', label: 'Do it', prompt: 'Do it now' }],
                    agentInstructions: {
                        content: '',
                        toolReferences: [],
                        metadata: undefined
                    },
                    model: undefined,
                    argumentHint: undefined,
                    tools: undefined,
                    target: undefined,
                    uri: URI.joinPath(rootFolderUri, '.github/agents/agent1.agent.md'),
                    source: { storage: PromptsStorage.local }
                },
            ];
            assert.deepEqual(result, expected, 'Must get custom agents.');
        });
        test('body with tool references', async () => {
            const rootFolderName = 'custom-agents';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            // mock current workspace file structure
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/.github/agents/agent1.agent.md`,
                    contents: [
                        '---',
                        'description: \'Agent file 1.\'',
                        'tools: [ tool1, tool2 ]',
                        '---',
                        'Do it with #tool:tool1',
                    ]
                },
                {
                    path: `${rootFolder}/.github/agents/agent2.agent.md`,
                    contents: [
                        'First use #tool:tool2\nThen use #tool:tool1',
                    ]
                }
            ]);
            const result = (await service.getCustomAgents(CancellationToken.None)).map(agent => ({ ...agent, uri: URI.from(agent.uri) }));
            const expected = [
                {
                    name: 'agent1',
                    description: 'Agent file 1.',
                    tools: ['tool1', 'tool2'],
                    agentInstructions: {
                        content: 'Do it with #tool:tool1',
                        toolReferences: [{ name: 'tool1', range: { start: 11, endExclusive: 17 } }],
                        metadata: undefined
                    },
                    handOffs: undefined,
                    model: undefined,
                    argumentHint: undefined,
                    target: undefined,
                    uri: URI.joinPath(rootFolderUri, '.github/agents/agent1.agent.md'),
                    source: { storage: PromptsStorage.local },
                },
                {
                    name: 'agent2',
                    agentInstructions: {
                        content: 'First use #tool:tool2\nThen use #tool:tool1',
                        toolReferences: [
                            { name: 'tool1', range: { start: 31, endExclusive: 37 } },
                            { name: 'tool2', range: { start: 10, endExclusive: 16 } }
                        ],
                        metadata: undefined
                    },
                    uri: URI.joinPath(rootFolderUri, '.github/agents/agent2.agent.md'),
                    source: { storage: PromptsStorage.local },
                }
            ];
            assert.deepEqual(result, expected, 'Must get custom agents.');
        });
        test('header with argumentHint', async () => {
            const rootFolderName = 'custom-agents-with-argument-hint';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/.github/agents/agent1.agent.md`,
                    contents: [
                        '---',
                        'description: \'Code review agent.\'',
                        'argument-hint: \'Provide file path or code snippet to review\'',
                        'tools: [ code-analyzer, linter ]',
                        '---',
                        'I will help review your code for best practices.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/agents/agent2.agent.md`,
                    contents: [
                        '---',
                        'description: \'Documentation generator.\'',
                        'argument-hint: \'Specify function or class name to document\'',
                        '---',
                        'I generate comprehensive documentation.',
                    ]
                }
            ]);
            const result = (await service.getCustomAgents(CancellationToken.None)).map(agent => ({ ...agent, uri: URI.from(agent.uri) }));
            const expected = [
                {
                    name: 'agent1',
                    description: 'Code review agent.',
                    argumentHint: 'Provide file path or code snippet to review',
                    tools: ['code-analyzer', 'linter'],
                    agentInstructions: {
                        content: 'I will help review your code for best practices.',
                        toolReferences: [],
                        metadata: undefined
                    },
                    handOffs: undefined,
                    model: undefined,
                    target: undefined,
                    uri: URI.joinPath(rootFolderUri, '.github/agents/agent1.agent.md'),
                    source: { storage: PromptsStorage.local }
                },
                {
                    name: 'agent2',
                    description: 'Documentation generator.',
                    argumentHint: 'Specify function or class name to document',
                    agentInstructions: {
                        content: 'I generate comprehensive documentation.',
                        toolReferences: [],
                        metadata: undefined
                    },
                    handOffs: undefined,
                    model: undefined,
                    tools: undefined,
                    target: undefined,
                    uri: URI.joinPath(rootFolderUri, '.github/agents/agent2.agent.md'),
                    source: { storage: PromptsStorage.local }
                },
            ];
            assert.deepEqual(result, expected, 'Must get custom agents with argumentHint.');
        });
        test('header with target', async () => {
            const rootFolderName = 'custom-agents-with-target';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/.github/agents/github-agent.agent.md`,
                    contents: [
                        '---',
                        'description: \'GitHub Copilot specialized agent.\'',
                        'target: \'github-copilot\'',
                        'tools: [ github-api, code-search ]',
                        '---',
                        'I am optimized for GitHub Copilot workflows.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/agents/vscode-agent.agent.md`,
                    contents: [
                        '---',
                        'description: \'VS Code specialized agent.\'',
                        'target: \'vscode\'',
                        'model: \'gpt-4\'',
                        '---',
                        'I am specialized for VS Code editor tasks.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/agents/generic-agent.agent.md`,
                    contents: [
                        '---',
                        'description: \'Generic agent without target.\'',
                        '---',
                        'I work everywhere.',
                    ]
                }
            ]);
            const result = (await service.getCustomAgents(CancellationToken.None)).map(agent => ({ ...agent, uri: URI.from(agent.uri) }));
            const expected = [
                {
                    name: 'github-agent',
                    description: 'GitHub Copilot specialized agent.',
                    target: 'github-copilot',
                    tools: ['github-api', 'code-search'],
                    agentInstructions: {
                        content: 'I am optimized for GitHub Copilot workflows.',
                        toolReferences: [],
                        metadata: undefined
                    },
                    handOffs: undefined,
                    model: undefined,
                    argumentHint: undefined,
                    uri: URI.joinPath(rootFolderUri, '.github/agents/github-agent.agent.md'),
                    source: { storage: PromptsStorage.local }
                },
                {
                    name: 'vscode-agent',
                    description: 'VS Code specialized agent.',
                    target: 'vscode',
                    model: 'gpt-4',
                    agentInstructions: {
                        content: 'I am specialized for VS Code editor tasks.',
                        toolReferences: [],
                        metadata: undefined
                    },
                    handOffs: undefined,
                    argumentHint: undefined,
                    tools: undefined,
                    uri: URI.joinPath(rootFolderUri, '.github/agents/vscode-agent.agent.md'),
                    source: { storage: PromptsStorage.local }
                },
                {
                    name: 'generic-agent',
                    description: 'Generic agent without target.',
                    agentInstructions: {
                        content: 'I work everywhere.',
                        toolReferences: [],
                        metadata: undefined
                    },
                    handOffs: undefined,
                    model: undefined,
                    argumentHint: undefined,
                    tools: undefined,
                    target: undefined,
                    uri: URI.joinPath(rootFolderUri, '.github/agents/generic-agent.agent.md'),
                    source: { storage: PromptsStorage.local }
                },
            ];
            assert.deepEqual(result, expected, 'Must get custom agents with target attribute.');
        });
        test('agents with .md extension (no .agent.md)', async () => {
            const rootFolderName = 'custom-agents-md-extension';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/.github/agents/demonstrate.md`,
                    contents: [
                        '---',
                        'description: \'Demonstrate agent.\'',
                        'tools: [ demo-tool ]',
                        '---',
                        'This is a demonstration agent using .md extension.',
                    ]
                },
                {
                    path: `${rootFolder}/.github/agents/test.md`,
                    contents: [
                        'Test agent without header.',
                    ]
                }
            ]);
            const result = (await service.getCustomAgents(CancellationToken.None)).map(agent => ({ ...agent, uri: URI.from(agent.uri) }));
            const expected = [
                {
                    name: 'demonstrate',
                    description: 'Demonstrate agent.',
                    tools: ['demo-tool'],
                    agentInstructions: {
                        content: 'This is a demonstration agent using .md extension.',
                        toolReferences: [],
                        metadata: undefined
                    },
                    handOffs: undefined,
                    model: undefined,
                    argumentHint: undefined,
                    target: undefined,
                    uri: URI.joinPath(rootFolderUri, '.github/agents/demonstrate.md'),
                    source: { storage: PromptsStorage.local },
                },
                {
                    name: 'test',
                    agentInstructions: {
                        content: 'Test agent without header.',
                        toolReferences: [],
                        metadata: undefined
                    },
                    uri: URI.joinPath(rootFolderUri, '.github/agents/test.md'),
                    source: { storage: PromptsStorage.local },
                }
            ];
            assert.deepEqual(result, expected, 'Must get custom agents with .md extension from .github/agents/ folder.');
        });
    });
    suite('listPromptFiles - extensions', () => {
        test('Contributed prompt file', async () => {
            const uri = URI.parse('file://extensions/my-extension/textMate.instructions.md');
            const extension = {};
            const registered = service.registerContributedFile(PromptsType.instructions, 'TextMate Instructions', 'Instructions to follow when authoring TextMate grammars', uri, extension);
            const actual = await service.listPromptFiles(PromptsType.instructions, CancellationToken.None);
            assert.strictEqual(actual.length, 1);
            assert.strictEqual(actual[0].uri.toString(), uri.toString());
            assert.strictEqual(actual[0].name, 'TextMate Instructions');
            assert.strictEqual(actual[0].storage, PromptsStorage.extension);
            assert.strictEqual(actual[0].type, PromptsType.instructions);
            registered.dispose();
        });
    });
    suite('findClaudeSkills', () => {
        teardown(() => {
            sinon.restore();
        });
        test('should return undefined when USE_CLAUDE_SKILLS is disabled', async () => {
            testConfigService.setUserConfiguration(PromptsConfig.USE_CLAUDE_SKILLS, false);
            const result = await service.findClaudeSkills(CancellationToken.None);
            assert.strictEqual(result, undefined);
        });
        test('should find Claude skills in workspace and user home', async () => {
            testConfigService.setUserConfiguration(PromptsConfig.USE_CLAUDE_SKILLS, true);
            const rootFolderName = 'claude-skills-test';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            // Create mock filesystem with skills
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/.claude/skills/project-skill-1/SKILL.md`,
                    contents: [
                        '---',
                        'name: "Project Skill 1"',
                        'description: "A project skill for testing"',
                        '---',
                        'This is project skill 1 content',
                    ],
                },
                {
                    path: `${rootFolder}/.claude/skills/project-skill-2/SKILL.md`,
                    contents: [
                        '---',
                        'description: "Invalid skill, no name"',
                        '---',
                        'This is project skill 2 content',
                    ],
                },
                {
                    path: `${rootFolder}/.claude/skills/not-a-skill-dir/README.md`,
                    contents: ['This is not a skill'],
                },
                {
                    path: '/home/user/.claude/skills/personal-skill-1/SKILL.md',
                    contents: [
                        '---',
                        'name: "Personal Skill 1"',
                        'description: "A personal skill for testing"',
                        '---',
                        'This is personal skill 1 content',
                    ],
                },
                {
                    path: '/home/user/.claude/skills/not-a-skill/other-file.md',
                    contents: ['Not a skill file'],
                },
            ]);
            const result = await service.findClaudeSkills(CancellationToken.None);
            assert.ok(result, 'Should return results when Claude skills are enabled');
            assert.strictEqual(result.length, 2, 'Should find 2 skills total');
            // Check project skills
            const projectSkills = result.filter(skill => skill.type === 'project');
            assert.strictEqual(projectSkills.length, 1, 'Should find 1 project skill');
            const projectSkill1 = projectSkills.find(skill => skill.name === 'Project Skill 1');
            assert.ok(projectSkill1, 'Should find project skill 1');
            assert.strictEqual(projectSkill1.description, 'A project skill for testing');
            assert.strictEqual(projectSkill1.uri.path, `${rootFolder}/.claude/skills/project-skill-1/SKILL.md`);
            // Check personal skills
            const personalSkills = result.filter(skill => skill.type === 'personal');
            assert.strictEqual(personalSkills.length, 1, 'Should find 1 personal skill');
            const personalSkill1 = personalSkills[0];
            assert.strictEqual(personalSkill1.name, 'Personal Skill 1');
            assert.strictEqual(personalSkill1.description, 'A personal skill for testing');
            assert.strictEqual(personalSkill1.uri.path, '/home/user/.claude/skills/personal-skill-1/SKILL.md');
        });
        test('should handle parsing errors gracefully', async () => {
            testConfigService.setUserConfiguration(PromptsConfig.USE_CLAUDE_SKILLS, true);
            const rootFolderName = 'claude-skills-error-test';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            // Create mock filesystem with malformed skill file
            await mockFiles(fileService, [
                {
                    path: `${rootFolder}/.claude/skills/valid-skill/SKILL.md`,
                    contents: [
                        '---',
                        'name: "Valid Skill"',
                        'description: "A valid skill"',
                        '---',
                        'Valid skill content',
                    ],
                },
                {
                    path: `${rootFolder}/.claude/skills/invalid-skill/SKILL.md`,
                    contents: [
                        '---',
                        'invalid yaml: [unclosed',
                        '---',
                        'Invalid skill content',
                    ],
                },
            ]);
            const result = await service.findClaudeSkills(CancellationToken.None);
            // Should still return the valid skill, even if one has parsing errors
            assert.ok(result, 'Should return results even with parsing errors');
            assert.strictEqual(result.length, 1, 'Should find 1 valid skill');
            assert.strictEqual(result[0].name, 'Valid Skill');
            assert.strictEqual(result[0].type, 'project');
        });
        test('should return empty array when no skills found', async () => {
            testConfigService.setUserConfiguration(PromptsConfig.USE_CLAUDE_SKILLS, true);
            const rootFolderName = 'empty-workspace';
            const rootFolder = `/${rootFolderName}`;
            const rootFolderUri = URI.file(rootFolder);
            workspaceContextService.setWorkspace(testWorkspace(rootFolderUri));
            // Create empty mock filesystem
            await mockFiles(fileService, []);
            const result = await service.findClaudeSkills(CancellationToken.None);
            assert.ok(result, 'Should return results array');
            assert.strictEqual(result.length, 0, 'Should find no skills');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0c1NlcnZpY2UudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9zZXJ2aWNlL3Byb21wdHNTZXJ2aWNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sS0FBSyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBQy9CLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzlELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUN6RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM1RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDckYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQzVHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHFGQUFxRixDQUFDO0FBRS9ILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNuRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDeEYsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sMEVBQTBF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