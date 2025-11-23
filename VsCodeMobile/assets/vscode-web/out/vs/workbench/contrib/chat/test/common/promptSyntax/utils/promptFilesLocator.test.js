/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';
import { match } from '../../../../../../../base/common/glob.js';
import { Schemas } from '../../../../../../../base/common/network.js';
import { basename, relativePath } from '../../../../../../../base/common/resources.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { mock } from '../../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../../../platform/files/common/files.js';
import { FileService } from '../../../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { TestInstantiationService } from '../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../../../../platform/workspace/common/workspace.js';
import { IWorkbenchEnvironmentService } from '../../../../../../services/environment/common/environmentService.js';
import { ISearchService } from '../../../../../../services/search/common/search.js';
import { IUserDataProfileService } from '../../../../../../services/userDataProfile/common/userDataProfile.js';
import { PromptsConfig } from '../../../../common/promptSyntax/config/config.js';
import { PromptsType } from '../../../../common/promptSyntax/promptTypes.js';
import { isValidGlob, PromptFilesLocator } from '../../../../common/promptSyntax/utils/promptFilesLocator.js';
import { MockFilesystem } from '../testUtils/mockFilesystem.js';
import { mockService } from './mock.js';
import { TestUserDataProfileService } from '../../../../../../test/common/workbenchTestServices.js';
import { PromptsStorage } from '../../../../common/promptSyntax/service/promptsService.js';
import { runWithFakedTimers } from '../../../../../../../base/test/common/timeTravelScheduler.js';
/**
 * Mocked instance of {@link IConfigurationService}.
 */
function mockConfigService(value) {
    return mockService({
        getValue(key) {
            assert(typeof key === 'string', `Expected string configuration key, got '${typeof key}'.`);
            if ('explorer.excludeGitIgnore' === key) {
                return false;
            }
            assert([PromptsConfig.PROMPT_LOCATIONS_KEY, PromptsConfig.INSTRUCTIONS_LOCATION_KEY, PromptsConfig.MODE_LOCATION_KEY].includes(key), `Unsupported configuration key '${key}'.`);
            return value;
        },
    });
}
/**
 * Mocked instance of {@link IWorkspaceContextService}.
 */
function mockWorkspaceService(folders) {
    return mockService({
        getWorkspace() {
            return new class extends mock() {
                constructor() {
                    super(...arguments);
                    this.folders = folders;
                }
            };
        },
        getWorkspaceFolder() {
            return null;
        }
    });
}
function testT(name, fn) {
    return test(name, () => runWithFakedTimers({ useFakeTimers: true }, fn));
}
suite('PromptFilesLocator', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    // if (isWindows) {
    // 	return;
    // }
    let instantiationService;
    setup(async () => {
        instantiationService = disposables.add(new TestInstantiationService());
        instantiationService.stub(ILogService, new NullLogService());
        const fileService = disposables.add(instantiationService.createInstance(FileService));
        const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
        disposables.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
        instantiationService.stub(IFileService, fileService);
    });
    /**
     * Create a new instance of {@link PromptFilesLocator} with provided mocked
     * values for configuration and workspace services.
     */
    const createPromptsLocator = async (configValue, workspaceFolderPaths, filesystem) => {
        const mockFs = instantiationService.createInstance(MockFilesystem, filesystem);
        await mockFs.mock();
        instantiationService.stub(IConfigurationService, mockConfigService(configValue));
        const workspaceFolders = workspaceFolderPaths.map((path, index) => {
            const uri = URI.file(path);
            return new class extends mock() {
                constructor() {
                    super(...arguments);
                    this.uri = uri;
                    this.name = basename(uri);
                    this.index = index;
                }
            };
        });
        instantiationService.stub(IWorkspaceContextService, mockWorkspaceService(workspaceFolders));
        instantiationService.stub(IWorkbenchEnvironmentService, {});
        instantiationService.stub(IUserDataProfileService, new TestUserDataProfileService());
        instantiationService.stub(ISearchService, {
            async fileSearch(query) {
                // mock the search service
                const fs = instantiationService.get(IFileService);
                const findFilesInLocation = async (location, results = []) => {
                    try {
                        const resolve = await fs.resolve(location);
                        if (resolve.isFile) {
                            results.push(resolve.resource);
                        }
                        else if (resolve.isDirectory && resolve.children) {
                            for (const child of resolve.children) {
                                await findFilesInLocation(child.resource, results);
                            }
                        }
                    }
                    catch (error) {
                    }
                    return results;
                };
                const results = [];
                for (const folderQuery of query.folderQueries) {
                    const allFiles = await findFilesInLocation(folderQuery.folder);
                    for (const resource of allFiles) {
                        const pathInFolder = relativePath(folderQuery.folder, resource) ?? '';
                        if (query.filePattern === undefined || match(query.filePattern, pathInFolder)) {
                            results.push({ resource });
                        }
                    }
                }
                return { results, messages: [] };
            }
        });
        const locator = instantiationService.createInstance(PromptFilesLocator);
        return {
            async listFiles(type, storage, token) {
                return locator.listFiles(type, storage, token);
            },
            getConfigBasedSourceFolders(type) {
                return locator.getConfigBasedSourceFolders(type);
            },
            async disposeAsync() {
                await mockFs.delete();
            }
        };
    };
    suite('empty workspace', () => {
        const EMPTY_WORKSPACE = [];
        suite('empty filesystem', () => {
            testT('no config value', async () => {
                const locator = await createPromptsLocator(undefined, EMPTY_WORKSPACE, []);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [], 'No prompts must be found.');
                await locator.disposeAsync();
            });
            testT('object config value', async () => {
                const locator = await createPromptsLocator({
                    '/Users/legomushroom/repos/prompts/': true,
                    '/tmp/prompts/': false,
                }, EMPTY_WORKSPACE, []);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [], 'No prompts must be found.');
                await locator.disposeAsync();
            });
            testT('array config value', async () => {
                const locator = await createPromptsLocator([
                    'relative/path/to/prompts/',
                    '/abs/path',
                ], EMPTY_WORKSPACE, []);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [], 'No prompts must be found.');
                await locator.disposeAsync();
            });
            testT('null config value', async () => {
                const locator = await createPromptsLocator(null, EMPTY_WORKSPACE, []);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [], 'No prompts must be found.');
                await locator.disposeAsync();
            });
            testT('string config value', async () => {
                const locator = await createPromptsLocator('/etc/hosts/prompts', EMPTY_WORKSPACE, []);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [], 'No prompts must be found.');
                await locator.disposeAsync();
            });
        });
        suite('non-empty filesystem', () => {
            testT('core logic', async () => {
                const locator = await createPromptsLocator({
                    '/Users/legomushroom/repos/prompts': true,
                    '/tmp/prompts/': true,
                    '/absolute/path/prompts': false,
                    '.copilot/prompts': true,
                }, EMPTY_WORKSPACE, [
                    {
                        name: '/Users/legomushroom/repos/prompts',
                        children: [
                            {
                                name: 'test.prompt.md',
                                contents: 'Hello, World!',
                            },
                            {
                                name: 'refactor-tests.prompt.md',
                                contents: 'some file content goes here',
                            },
                        ],
                    },
                    {
                        name: '/tmp/prompts',
                        children: [
                            {
                                name: 'translate.to-rust.prompt.md',
                                contents: 'some more random file contents',
                            },
                        ],
                    },
                    {
                        name: '/absolute/path/prompts',
                        children: [
                            {
                                name: 'some-prompt-file.prompt.md',
                                contents: 'hey hey hey',
                            },
                        ],
                    },
                ]);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                    '/Users/legomushroom/repos/prompts/test.prompt.md',
                    '/Users/legomushroom/repos/prompts/refactor-tests.prompt.md',
                    '/tmp/prompts/translate.to-rust.prompt.md'
                ], 'Must find correct prompts.');
                await locator.disposeAsync();
            });
            suite('absolute', () => {
                testT('wild card', async () => {
                    const settings = [
                        '/Users/legomushroom/repos/vscode/**',
                        '/Users/legomushroom/repos/vscode/**/*.prompt.md',
                        '/Users/legomushroom/repos/vscode/**/*.md',
                        '/Users/legomushroom/repos/vscode/**/*',
                        '/Users/legomushroom/repos/vscode/deps/**',
                        '/Users/legomushroom/repos/vscode/deps/**/*.prompt.md',
                        '/Users/legomushroom/repos/vscode/deps/**/*',
                        '/Users/legomushroom/repos/vscode/deps/**/*.md',
                        '/Users/legomushroom/repos/vscode/**/text/**',
                        '/Users/legomushroom/repos/vscode/**/text/**/*',
                        '/Users/legomushroom/repos/vscode/**/text/**/*.md',
                        '/Users/legomushroom/repos/vscode/**/text/**/*.prompt.md',
                        '/Users/legomushroom/repos/vscode/deps/text/**',
                        '/Users/legomushroom/repos/vscode/deps/text/**/*',
                        '/Users/legomushroom/repos/vscode/deps/text/**/*.md',
                        '/Users/legomushroom/repos/vscode/deps/text/**/*.prompt.md',
                    ];
                    for (const setting of settings) {
                        const locator = await createPromptsLocator({ [setting]: true }, EMPTY_WORKSPACE, [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'deps/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rabot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/deps/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
                testT(`specific`, async () => {
                    const testSettings = [
                        [
                            '/Users/legomushroom/repos/vscode/**/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*specific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*specific*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/specific*',
                            '/Users/legomushroom/repos/vscode/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/**/unspecific2.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/**/unspecific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/**/nested/unspecific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/nested/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*spec*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*spec*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*spec*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/deps/**/*spec*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/text/**/*spec*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/nested/*spec*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/nested/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/specific*',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/specific*.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific2.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific1*.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific2*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/specific*',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/specific*.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific2.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific1*.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific2*.md',
                        ],
                    ];
                    for (const settings of testSettings) {
                        const vscodeSettings = {};
                        for (const setting of settings) {
                            vscodeSettings[setting] = true;
                        }
                        const locator = await createPromptsLocator(vscodeSettings, EMPTY_WORKSPACE, [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'deps/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'default.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rawbot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
            });
        });
    });
    suite('single-root workspace', () => {
        suite('glob pattern', () => {
            suite('relative', () => {
                testT('wild card', async () => {
                    const testSettings = [
                        '**',
                        '**/*.prompt.md',
                        '**/*.md',
                        '**/*',
                        'deps/**',
                        'deps/**/*.prompt.md',
                        'deps/**/*',
                        'deps/**/*.md',
                        '**/text/**',
                        '**/text/**/*',
                        '**/text/**/*.md',
                        '**/text/**/*.prompt.md',
                        'deps/text/**',
                        'deps/text/**/*',
                        'deps/text/**/*.md',
                        'deps/text/**/*.prompt.md',
                    ];
                    for (const setting of testSettings) {
                        const locator = await createPromptsLocator({ [setting]: true }, ['/Users/legomushroom/repos/vscode'], [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'deps/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rabot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/deps/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
                testT(`specific`, async () => {
                    const testSettings = [
                        [
                            '**/*specific*',
                        ],
                        [
                            '**/*specific*.prompt.md',
                        ],
                        [
                            '**/*specific*.md',
                        ],
                        [
                            '**/specific*',
                            '**/unspecific1.prompt.md',
                            '**/unspecific2.prompt.md',
                        ],
                        [
                            '**/specific.prompt.md',
                            '**/unspecific*.prompt.md',
                        ],
                        [
                            '**/nested/specific.prompt.md',
                            '**/nested/unspecific*.prompt.md',
                        ],
                        [
                            '**/nested/*specific*',
                        ],
                        [
                            '**/*spec*.prompt.md',
                        ],
                        [
                            '**/*spec*',
                        ],
                        [
                            '**/*spec*.md',
                        ],
                        [
                            '**/deps/**/*spec*.md',
                        ],
                        [
                            '**/text/**/*spec*.md',
                        ],
                        [
                            'deps/text/nested/*spec*',
                        ],
                        [
                            'deps/text/nested/*specific*',
                        ],
                        [
                            'deps/**/*specific*',
                        ],
                        [
                            'deps/**/specific*',
                            'deps/**/unspecific*.prompt.md',
                        ],
                        [
                            'deps/**/specific*.md',
                            'deps/**/unspecific*.md',
                        ],
                        [
                            'deps/**/specific.prompt.md',
                            'deps/**/unspecific1.prompt.md',
                            'deps/**/unspecific2.prompt.md',
                        ],
                        [
                            'deps/**/specific.prompt.md',
                            'deps/**/unspecific1*.md',
                            'deps/**/unspecific2*.md',
                        ],
                        [
                            'deps/text/**/*specific*',
                        ],
                        [
                            'deps/text/**/specific*',
                            'deps/text/**/unspecific*.prompt.md',
                        ],
                        [
                            'deps/text/**/specific*.md',
                            'deps/text/**/unspecific*.md',
                        ],
                        [
                            'deps/text/**/specific.prompt.md',
                            'deps/text/**/unspecific1.prompt.md',
                            'deps/text/**/unspecific2.prompt.md',
                        ],
                        [
                            'deps/text/**/specific.prompt.md',
                            'deps/text/**/unspecific1*.md',
                            'deps/text/**/unspecific2*.md',
                        ],
                    ];
                    for (const settings of testSettings) {
                        const vscodeSettings = {};
                        for (const setting of settings) {
                            vscodeSettings[setting] = true;
                        }
                        const locator = await createPromptsLocator(vscodeSettings, ['/Users/legomushroom/repos/vscode'], [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'deps/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'default.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rawbot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
            });
            suite('absolute', () => {
                testT('wild card', async () => {
                    const settings = [
                        '/Users/legomushroom/repos/vscode/**',
                        '/Users/legomushroom/repos/vscode/**/*.prompt.md',
                        '/Users/legomushroom/repos/vscode/**/*.md',
                        '/Users/legomushroom/repos/vscode/**/*',
                        '/Users/legomushroom/repos/vscode/deps/**',
                        '/Users/legomushroom/repos/vscode/deps/**/*.prompt.md',
                        '/Users/legomushroom/repos/vscode/deps/**/*',
                        '/Users/legomushroom/repos/vscode/deps/**/*.md',
                        '/Users/legomushroom/repos/vscode/**/text/**',
                        '/Users/legomushroom/repos/vscode/**/text/**/*',
                        '/Users/legomushroom/repos/vscode/**/text/**/*.md',
                        '/Users/legomushroom/repos/vscode/**/text/**/*.prompt.md',
                        '/Users/legomushroom/repos/vscode/deps/text/**',
                        '/Users/legomushroom/repos/vscode/deps/text/**/*',
                        '/Users/legomushroom/repos/vscode/deps/text/**/*.md',
                        '/Users/legomushroom/repos/vscode/deps/text/**/*.prompt.md',
                    ];
                    for (const setting of settings) {
                        const locator = await createPromptsLocator({ [setting]: true }, ['/Users/legomushroom/repos/vscode'], [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'deps/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rabot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/deps/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
                testT(`specific`, async () => {
                    const testSettings = [
                        [
                            '/Users/legomushroom/repos/vscode/**/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*specific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*specific*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/specific*',
                            '/Users/legomushroom/repos/vscode/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/**/unspecific2.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/**/unspecific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/**/nested/unspecific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/nested/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*spec*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*spec*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/*spec*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/deps/**/*spec*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/**/text/**/*spec*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/nested/*spec*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/nested/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/specific*',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/specific*.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific2.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific1*.md',
                            '/Users/legomushroom/repos/vscode/deps/**/unspecific2*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/*specific*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/specific*',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/specific*.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific2.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/deps/text/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific1*.md',
                            '/Users/legomushroom/repos/vscode/deps/text/**/unspecific2*.md',
                        ],
                    ];
                    for (const settings of testSettings) {
                        const vscodeSettings = {};
                        for (const setting of settings) {
                            vscodeSettings[setting] = true;
                        }
                        const locator = await createPromptsLocator(vscodeSettings, ['/Users/legomushroom/repos/vscode'], [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'deps/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'default.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rawbot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/deps/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/deps/text/nested/unspecific2.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
            });
        });
    });
    testT('core logic', async () => {
        const locator = await createPromptsLocator({
            '/Users/legomushroom/repos/prompts': true,
            '/tmp/prompts/': true,
            '/absolute/path/prompts': false,
            '.copilot/prompts': true,
        }, [
            '/Users/legomushroom/repos/vscode',
        ], [
            {
                name: '/Users/legomushroom/repos/prompts',
                children: [
                    {
                        name: 'test.prompt.md',
                        contents: 'Hello, World!',
                    },
                    {
                        name: 'refactor-tests.prompt.md',
                        contents: 'some file content goes here',
                    },
                ],
            },
            {
                name: '/tmp/prompts',
                children: [
                    {
                        name: 'translate.to-rust.prompt.md',
                        contents: 'some more random file contents',
                    },
                ],
            },
            {
                name: '/absolute/path/prompts',
                children: [
                    {
                        name: 'some-prompt-file.prompt.md',
                        contents: 'hey hey hey',
                    },
                ],
            },
            {
                name: '/Users/legomushroom/repos/vscode',
                children: [
                    {
                        name: '.copilot/prompts',
                        children: [
                            {
                                name: 'default.prompt.md',
                                contents: 'oh hi, robot!',
                            },
                        ],
                    },
                    {
                        name: '.github/prompts',
                        children: [
                            {
                                name: 'my.prompt.md',
                                contents: 'oh hi, bot!',
                            },
                        ],
                    },
                ],
            },
        ]);
        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
            '/Users/legomushroom/repos/vscode/.github/prompts/my.prompt.md',
            '/Users/legomushroom/repos/prompts/test.prompt.md',
            '/Users/legomushroom/repos/prompts/refactor-tests.prompt.md',
            '/tmp/prompts/translate.to-rust.prompt.md',
            '/Users/legomushroom/repos/vscode/.copilot/prompts/default.prompt.md',
        ], 'Must find correct prompts.');
        await locator.disposeAsync();
    });
    testT('with disabled `.github/prompts` location', async () => {
        const locator = await createPromptsLocator({
            '/Users/legomushroom/repos/prompts': true,
            '/tmp/prompts/': true,
            '/absolute/path/prompts': false,
            '.copilot/prompts': true,
            '.github/prompts': false,
        }, [
            '/Users/legomushroom/repos/vscode',
        ], [
            {
                name: '/Users/legomushroom/repos/prompts',
                children: [
                    {
                        name: 'test.prompt.md',
                        contents: 'Hello, World!',
                    },
                    {
                        name: 'refactor-tests.prompt.md',
                        contents: 'some file content goes here',
                    },
                ],
            },
            {
                name: '/tmp/prompts',
                children: [
                    {
                        name: 'translate.to-rust.prompt.md',
                        contents: 'some more random file contents',
                    },
                ],
            },
            {
                name: '/absolute/path/prompts',
                children: [
                    {
                        name: 'some-prompt-file.prompt.md',
                        contents: 'hey hey hey',
                    },
                ],
            },
            {
                name: '/Users/legomushroom/repos/vscode',
                children: [
                    {
                        name: '.copilot/prompts',
                        children: [
                            {
                                name: 'default.prompt.md',
                                contents: 'oh hi, robot!',
                            },
                        ],
                    },
                    {
                        name: '.github/prompts',
                        children: [
                            {
                                name: 'my.prompt.md',
                                contents: 'oh hi, bot!',
                            },
                            {
                                name: 'your.prompt.md',
                                contents: 'oh hi, bot!',
                            },
                        ],
                    },
                ],
            },
        ]);
        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
            '/Users/legomushroom/repos/prompts/test.prompt.md',
            '/Users/legomushroom/repos/prompts/refactor-tests.prompt.md',
            '/tmp/prompts/translate.to-rust.prompt.md',
            '/Users/legomushroom/repos/vscode/.copilot/prompts/default.prompt.md',
        ], 'Must find correct prompts.');
        await locator.disposeAsync();
    });
    suite('multi-root workspace', () => {
        suite('core logic', () => {
            testT('without top-level `.github` folder', async () => {
                const locator = await createPromptsLocator({
                    '/Users/legomushroom/repos/prompts': true,
                    '/tmp/prompts/': true,
                    '/absolute/path/prompts': false,
                    '.copilot/prompts': false,
                }, [
                    '/Users/legomushroom/repos/vscode',
                    '/Users/legomushroom/repos/node',
                ], [
                    {
                        name: '/Users/legomushroom/repos/prompts',
                        children: [
                            {
                                name: 'test.prompt.md',
                                contents: 'Hello, World!',
                            },
                            {
                                name: 'refactor-tests.prompt.md',
                                contents: 'some file content goes here',
                            },
                        ],
                    },
                    {
                        name: '/tmp/prompts',
                        children: [
                            {
                                name: 'translate.to-rust.prompt.md',
                                contents: 'some more random file contents',
                            },
                        ],
                    },
                    {
                        name: '/absolute/path/prompts',
                        children: [
                            {
                                name: 'some-prompt-file.prompt.md',
                                contents: 'hey hey hey',
                            },
                        ],
                    },
                    {
                        name: '/Users/legomushroom/repos/vscode',
                        children: [
                            {
                                name: '.copilot/prompts',
                                children: [
                                    {
                                        name: 'prompt1.prompt.md',
                                        contents: 'oh hi, robot!',
                                    },
                                ],
                            },
                            {
                                name: '.github/prompts',
                                children: [
                                    {
                                        name: 'default.prompt.md',
                                        contents: 'oh hi, bot!',
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        name: '/Users/legomushroom/repos/node',
                        children: [
                            {
                                name: '.copilot/prompts',
                                children: [
                                    {
                                        name: 'prompt5.prompt.md',
                                        contents: 'oh hi, robot!',
                                    },
                                ],
                            },
                            {
                                name: '.github/prompts',
                                children: [
                                    {
                                        name: 'refactor-static-classes.prompt.md',
                                        contents: 'file contents',
                                    },
                                ],
                            },
                        ],
                    },
                    // note! this folder is not part of the workspace, so prompt files are `ignored`
                    {
                        name: '/Users/legomushroom/repos/.github/prompts',
                        children: [
                            {
                                name: 'prompt-name.prompt.md',
                                contents: 'oh hi, robot!',
                            },
                            {
                                name: 'name-of-the-prompt.prompt.md',
                                contents: 'oh hi, raw bot!',
                            },
                        ],
                    },
                ]);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                    '/Users/legomushroom/repos/vscode/.github/prompts/default.prompt.md',
                    '/Users/legomushroom/repos/node/.github/prompts/refactor-static-classes.prompt.md',
                    '/Users/legomushroom/repos/prompts/test.prompt.md',
                    '/Users/legomushroom/repos/prompts/refactor-tests.prompt.md',
                    '/tmp/prompts/translate.to-rust.prompt.md',
                ], 'Must find correct prompts.');
                await locator.disposeAsync();
            });
            testT('with top-level `.github` folder', async () => {
                const locator = await createPromptsLocator({
                    '/Users/legomushroom/repos/prompts': true,
                    '/tmp/prompts/': true,
                    '/absolute/path/prompts': false,
                    '.copilot/prompts': false,
                }, [
                    '/Users/legomushroom/repos/vscode',
                    '/Users/legomushroom/repos/node',
                    '/var/shared/prompts',
                ], [
                    {
                        name: '/Users/legomushroom/repos/prompts',
                        children: [
                            {
                                name: 'test.prompt.md',
                                contents: 'Hello, World!',
                            },
                            {
                                name: 'refactor-tests.prompt.md',
                                contents: 'some file content goes here',
                            },
                        ],
                    },
                    {
                        name: '/tmp/prompts',
                        children: [
                            {
                                name: 'translate.to-rust.prompt.md',
                                contents: 'some more random file contents',
                            },
                        ],
                    },
                    {
                        name: '/absolute/path/prompts',
                        children: [
                            {
                                name: 'some-prompt-file.prompt.md',
                                contents: 'hey hey hey',
                            },
                        ],
                    },
                    {
                        name: '/Users/legomushroom/repos/vscode',
                        children: [
                            {
                                name: '.copilot/prompts',
                                children: [
                                    {
                                        name: 'prompt1.prompt.md',
                                        contents: 'oh hi, robot!',
                                    },
                                ],
                            },
                            {
                                name: '.github/prompts',
                                children: [
                                    {
                                        name: 'default.prompt.md',
                                        contents: 'oh hi, bot!',
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        name: '/Users/legomushroom/repos/node',
                        children: [
                            {
                                name: '.copilot/prompts',
                                children: [
                                    {
                                        name: 'prompt5.prompt.md',
                                        contents: 'oh hi, robot!',
                                    },
                                ],
                            },
                            {
                                name: '.github/prompts',
                                children: [
                                    {
                                        name: 'refactor-static-classes.prompt.md',
                                        contents: 'file contents',
                                    },
                                ],
                            },
                        ],
                    },
                    // note! this folder is part of the workspace, so prompt files are `included`
                    {
                        name: '/var/shared/prompts/.github/prompts',
                        children: [
                            {
                                name: 'prompt-name.prompt.md',
                                contents: 'oh hi, robot!',
                            },
                            {
                                name: 'name-of-the-prompt.prompt.md',
                                contents: 'oh hi, raw bot!',
                            },
                        ],
                    },
                ]);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                    '/Users/legomushroom/repos/vscode/.github/prompts/default.prompt.md',
                    '/Users/legomushroom/repos/node/.github/prompts/refactor-static-classes.prompt.md',
                    '/var/shared/prompts/.github/prompts/prompt-name.prompt.md',
                    '/var/shared/prompts/.github/prompts/name-of-the-prompt.prompt.md',
                    '/Users/legomushroom/repos/prompts/test.prompt.md',
                    '/Users/legomushroom/repos/prompts/refactor-tests.prompt.md',
                    '/tmp/prompts/translate.to-rust.prompt.md',
                ], 'Must find correct prompts.');
                await locator.disposeAsync();
            });
            testT('with disabled `.github/prompts` location', async () => {
                const locator = await createPromptsLocator({
                    '/Users/legomushroom/repos/prompts': true,
                    '/tmp/prompts/': true,
                    '/absolute/path/prompts': false,
                    '.copilot/prompts': false,
                    '.github/prompts': false,
                }, [
                    '/Users/legomushroom/repos/vscode',
                    '/Users/legomushroom/repos/node',
                    '/var/shared/prompts',
                ], [
                    {
                        name: '/Users/legomushroom/repos/prompts',
                        children: [
                            {
                                name: 'test.prompt.md',
                                contents: 'Hello, World!',
                            },
                            {
                                name: 'refactor-tests.prompt.md',
                                contents: 'some file content goes here',
                            },
                        ],
                    },
                    {
                        name: '/tmp/prompts',
                        children: [
                            {
                                name: 'translate.to-rust.prompt.md',
                                contents: 'some more random file contents',
                            },
                        ],
                    },
                    {
                        name: '/absolute/path/prompts',
                        children: [
                            {
                                name: 'some-prompt-file.prompt.md',
                                contents: 'hey hey hey',
                            },
                        ],
                    },
                    {
                        name: '/Users/legomushroom/repos/vscode',
                        children: [
                            {
                                name: '.copilot/prompts',
                                children: [
                                    {
                                        name: 'prompt1.prompt.md',
                                        contents: 'oh hi, robot!',
                                    },
                                ],
                            },
                            {
                                name: '.github/prompts',
                                children: [
                                    {
                                        name: 'default.prompt.md',
                                        contents: 'oh hi, bot!',
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        name: '/Users/legomushroom/repos/node',
                        children: [
                            {
                                name: '.copilot/prompts',
                                children: [
                                    {
                                        name: 'prompt5.prompt.md',
                                        contents: 'oh hi, robot!',
                                    },
                                ],
                            },
                            {
                                name: '.github/prompts',
                                children: [
                                    {
                                        name: 'refactor-static-classes.prompt.md',
                                        contents: 'file contents',
                                    },
                                ],
                            },
                        ],
                    },
                    // note! this folder is part of the workspace, so prompt files are `included`
                    {
                        name: '/var/shared/prompts/.github/prompts',
                        children: [
                            {
                                name: 'prompt-name.prompt.md',
                                contents: 'oh hi, robot!',
                            },
                            {
                                name: 'name-of-the-prompt.prompt.md',
                                contents: 'oh hi, raw bot!',
                            },
                        ],
                    },
                ]);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                    '/Users/legomushroom/repos/prompts/test.prompt.md',
                    '/Users/legomushroom/repos/prompts/refactor-tests.prompt.md',
                    '/tmp/prompts/translate.to-rust.prompt.md',
                ], 'Must find correct prompts.');
                await locator.disposeAsync();
            });
            testT('mixed', async () => {
                const locator = await createPromptsLocator({
                    '/Users/legomushroom/repos/**/*test*': true,
                    '.copilot/prompts': false,
                    '.github/prompts': true,
                    '/absolute/path/prompts/some-prompt-file.prompt.md': true,
                }, [
                    '/Users/legomushroom/repos/vscode',
                    '/Users/legomushroom/repos/node',
                    '/var/shared/prompts',
                ], [
                    {
                        name: '/Users/legomushroom/repos/prompts',
                        children: [
                            {
                                name: 'test.prompt.md',
                                contents: 'Hello, World!',
                            },
                            {
                                name: 'refactor-tests.prompt.md',
                                contents: 'some file content goes here',
                            },
                            {
                                name: 'elf.prompt.md',
                                contents: 'haalo!',
                            },
                        ],
                    },
                    {
                        name: '/tmp/prompts',
                        children: [
                            {
                                name: 'translate.to-rust.prompt.md',
                                contents: 'some more random file contents',
                            },
                        ],
                    },
                    {
                        name: '/absolute/path/prompts',
                        children: [
                            {
                                name: 'some-prompt-file.prompt.md',
                                contents: 'hey hey hey',
                            },
                        ],
                    },
                    {
                        name: '/Users/legomushroom/repos/vscode',
                        children: [
                            {
                                name: '.copilot/prompts',
                                children: [
                                    {
                                        name: 'prompt1.prompt.md',
                                        contents: 'oh hi, robot!',
                                    },
                                ],
                            },
                            {
                                name: '.github/prompts',
                                children: [
                                    {
                                        name: 'default.prompt.md',
                                        contents: 'oh hi, bot!',
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        name: '/Users/legomushroom/repos/node',
                        children: [
                            {
                                name: '.copilot/prompts',
                                children: [
                                    {
                                        name: 'prompt5.prompt.md',
                                        contents: 'oh hi, robot!',
                                    },
                                ],
                            },
                            {
                                name: '.github/prompts',
                                children: [
                                    {
                                        name: 'refactor-static-classes.prompt.md',
                                        contents: 'file contents',
                                    },
                                ],
                            },
                        ],
                    },
                    // note! this folder is part of the workspace, so prompt files are `included`
                    {
                        name: '/var/shared/prompts/.github/prompts',
                        children: [
                            {
                                name: 'prompt-name.prompt.md',
                                contents: 'oh hi, robot!',
                            },
                            {
                                name: 'name-of-the-prompt.prompt.md',
                                contents: 'oh hi, raw bot!',
                            },
                        ],
                    },
                ]);
                assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                    // all of these are due to the `.github/prompts` setting
                    '/Users/legomushroom/repos/vscode/.github/prompts/default.prompt.md',
                    '/Users/legomushroom/repos/node/.github/prompts/refactor-static-classes.prompt.md',
                    '/var/shared/prompts/.github/prompts/prompt-name.prompt.md',
                    '/var/shared/prompts/.github/prompts/name-of-the-prompt.prompt.md',
                    // all of these are due to the `/Users/legomushroom/repos/**/*test*` setting
                    '/Users/legomushroom/repos/prompts/test.prompt.md',
                    '/Users/legomushroom/repos/prompts/refactor-tests.prompt.md',
                    // this one is due to the specific `/absolute/path/prompts/some-prompt-file.prompt.md` setting
                    '/absolute/path/prompts/some-prompt-file.prompt.md',
                ], 'Must find correct prompts.');
                await locator.disposeAsync();
            });
        });
        suite('glob pattern', () => {
            suite('relative', () => {
                testT('wild card', async () => {
                    const testSettings = [
                        '**',
                        '**/*.prompt.md',
                        '**/*.md',
                        '**/*',
                        'gen*/**',
                        'gen*/**/*.prompt.md',
                        'gen*/**/*',
                        'gen*/**/*.md',
                        '**/gen*/**',
                        '**/gen*/**/*',
                        '**/gen*/**/*.md',
                        '**/gen*/**/*.prompt.md',
                        '{generic,general,gen}/**',
                        '{generic,general,gen}/**/*.prompt.md',
                        '{generic,general,gen}/**/*',
                        '{generic,general,gen}/**/*.md',
                        '**/{generic,general,gen}/**',
                        '**/{generic,general,gen}/**/*',
                        '**/{generic,general,gen}/**/*.md',
                        '**/{generic,general,gen}/**/*.prompt.md',
                    ];
                    for (const setting of testSettings) {
                        const locator = await createPromptsLocator({ [setting]: true }, [
                            '/Users/legomushroom/repos/vscode',
                            '/Users/legomushroom/repos/prompts',
                        ], [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'gen/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rabot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                            {
                                name: '/Users/legomushroom/repos/prompts',
                                children: [
                                    {
                                        name: 'general',
                                        children: [
                                            {
                                                name: 'common.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'uncommon-10.prompt.md',
                                                contents: 'oh hi, robot!',
                                            },
                                            {
                                                name: 'license.md',
                                                contents: 'non prompt file',
                                            },
                                        ],
                                    }
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/gen/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md',
                            // -
                            '/Users/legomushroom/repos/prompts/general/common.prompt.md',
                            '/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
                testT(`specific`, async () => {
                    const testSettings = [
                        [
                            '**/my.prompt.md',
                            '**/*specific*',
                            '**/*common*',
                        ],
                        [
                            '**/my.prompt.md',
                            '**/*specific*.prompt.md',
                            '**/*common*.prompt.md',
                        ],
                        [
                            '**/my*.md',
                            '**/*specific*.md',
                            '**/*common*.md',
                        ],
                        [
                            '**/my*.md',
                            '**/specific*',
                            '**/unspecific*',
                            '**/common*',
                            '**/uncommon*',
                        ],
                        [
                            '**/my.prompt.md',
                            '**/specific.prompt.md',
                            '**/unspecific1.prompt.md',
                            '**/unspecific2.prompt.md',
                            '**/common.prompt.md',
                            '**/uncommon-10.prompt.md',
                        ],
                        [
                            'gen*/**/my.prompt.md',
                            'gen*/**/*specific*',
                            'gen*/**/*common*',
                        ],
                        [
                            'gen*/**/my.prompt.md',
                            'gen*/**/*specific*.prompt.md',
                            'gen*/**/*common*.prompt.md',
                        ],
                        [
                            'gen*/**/my*.md',
                            'gen*/**/*specific*.md',
                            'gen*/**/*common*.md',
                        ],
                        [
                            'gen*/**/my*.md',
                            'gen*/**/specific*',
                            'gen*/**/unspecific*',
                            'gen*/**/common*',
                            'gen*/**/uncommon*',
                        ],
                        [
                            'gen*/**/my.prompt.md',
                            'gen*/**/specific.prompt.md',
                            'gen*/**/unspecific1.prompt.md',
                            'gen*/**/unspecific2.prompt.md',
                            'gen*/**/common.prompt.md',
                            'gen*/**/uncommon-10.prompt.md',
                        ],
                        [
                            'gen/text/my.prompt.md',
                            'gen/text/nested/specific.prompt.md',
                            'gen/text/nested/unspecific1.prompt.md',
                            'gen/text/nested/unspecific2.prompt.md',
                            'general/common.prompt.md',
                            'general/uncommon-10.prompt.md',
                        ],
                        [
                            'gen/text/my.prompt.md',
                            'gen/text/nested/*specific*',
                            'general/*common*',
                        ],
                        [
                            'gen/text/my.prompt.md',
                            'gen/text/**/specific.prompt.md',
                            'gen/text/**/unspecific1.prompt.md',
                            'gen/text/**/unspecific2.prompt.md',
                            'general/*',
                        ],
                        [
                            '{gen,general}/**/my.prompt.md',
                            '{gen,general}/**/*specific*',
                            '{gen,general}/**/*common*',
                        ],
                        [
                            '{gen,general}/**/my.prompt.md',
                            '{gen,general}/**/*specific*.prompt.md',
                            '{gen,general}/**/*common*.prompt.md',
                        ],
                        [
                            '{gen,general}/**/my*.md',
                            '{gen,general}/**/*specific*.md',
                            '{gen,general}/**/*common*.md',
                        ],
                        [
                            '{gen,general}/**/my*.md',
                            '{gen,general}/**/specific*',
                            '{gen,general}/**/unspecific*',
                            '{gen,general}/**/common*',
                            '{gen,general}/**/uncommon*',
                        ],
                        [
                            '{gen,general}/**/my.prompt.md',
                            '{gen,general}/**/specific.prompt.md',
                            '{gen,general}/**/unspecific1.prompt.md',
                            '{gen,general}/**/unspecific2.prompt.md',
                            '{gen,general}/**/common.prompt.md',
                            '{gen,general}/**/uncommon-10.prompt.md',
                        ],
                    ];
                    for (const settings of testSettings) {
                        const vscodeSettings = {};
                        for (const setting of settings) {
                            vscodeSettings[setting] = true;
                        }
                        const locator = await createPromptsLocator(vscodeSettings, [
                            '/Users/legomushroom/repos/vscode',
                            '/Users/legomushroom/repos/prompts',
                        ], [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'gen/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rabot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                            {
                                name: '/Users/legomushroom/repos/prompts',
                                children: [
                                    {
                                        name: 'general',
                                        children: [
                                            {
                                                name: 'common.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'uncommon-10.prompt.md',
                                                contents: 'oh hi, robot!',
                                            },
                                            {
                                                name: 'license.md',
                                                contents: 'non prompt file',
                                            },
                                        ],
                                    }
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/gen/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md',
                            // -
                            '/Users/legomushroom/repos/prompts/general/common.prompt.md',
                            '/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
            });
            suite('absolute', () => {
                testT('wild card', async () => {
                    const testSettings = [
                        '/Users/legomushroom/repos/**',
                        '/Users/legomushroom/repos/**/*.prompt.md',
                        '/Users/legomushroom/repos/**/*.md',
                        '/Users/legomushroom/repos/**/*',
                        '/Users/legomushroom/repos/**/gen*/**',
                        '/Users/legomushroom/repos/**/gen*/**/*.prompt.md',
                        '/Users/legomushroom/repos/**/gen*/**/*',
                        '/Users/legomushroom/repos/**/gen*/**/*.md',
                        '/Users/legomushroom/repos/**/gen*/**',
                        '/Users/legomushroom/repos/**/gen*/**/*',
                        '/Users/legomushroom/repos/**/gen*/**/*.md',
                        '/Users/legomushroom/repos/**/gen*/**/*.prompt.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/*.prompt.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/*.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/*',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*.prompt.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/gen*/**/*.prompt.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*.prompt.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*.md',
                        '/Users/legomushroom/repos/{vscode,prompts}/**/{general,gen}/**/*.prompt.md',
                    ];
                    for (const setting of testSettings) {
                        const locator = await createPromptsLocator({ [setting]: true }, [
                            '/Users/legomushroom/repos/vscode',
                            '/Users/legomushroom/repos/prompts',
                        ], [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'gen/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rabot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                            {
                                name: '/Users/legomushroom/repos/prompts',
                                children: [
                                    {
                                        name: 'general',
                                        children: [
                                            {
                                                name: 'common.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'uncommon-10.prompt.md',
                                                contents: 'oh hi, robot!',
                                            },
                                            {
                                                name: 'license.md',
                                                contents: 'non prompt file',
                                            },
                                        ],
                                    }
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/gen/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md',
                            // -
                            '/Users/legomushroom/repos/prompts/general/common.prompt.md',
                            '/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
                testT(`specific`, async () => {
                    const testSettings = [
                        [
                            '/Users/legomushroom/repos/**/my.prompt.md',
                            '/Users/legomushroom/repos/**/*specific*',
                            '/Users/legomushroom/repos/**/*common*',
                        ],
                        [
                            '/Users/legomushroom/repos/**/my.prompt.md',
                            '/Users/legomushroom/repos/**/*specific*.prompt.md',
                            '/Users/legomushroom/repos/**/*common*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/**/my*.md',
                            '/Users/legomushroom/repos/**/*specific*.md',
                            '/Users/legomushroom/repos/**/*common*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/**/my*.md',
                            '/Users/legomushroom/repos/**/specific*',
                            '/Users/legomushroom/repos/**/unspecific*',
                            '/Users/legomushroom/repos/**/common*',
                            '/Users/legomushroom/repos/**/uncommon*',
                        ],
                        [
                            '/Users/legomushroom/repos/**/my.prompt.md',
                            '/Users/legomushroom/repos/**/specific.prompt.md',
                            '/Users/legomushroom/repos/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/**/unspecific2.prompt.md',
                            '/Users/legomushroom/repos/**/common.prompt.md',
                            '/Users/legomushroom/repos/**/uncommon-10.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/**/gen*/**/my.prompt.md',
                            '/Users/legomushroom/repos/**/gen*/**/*specific*',
                            '/Users/legomushroom/repos/**/gen*/**/*common*',
                        ],
                        [
                            '/Users/legomushroom/repos/**/gen*/**/my.prompt.md',
                            '/Users/legomushroom/repos/**/gen*/**/*specific*.prompt.md',
                            '/Users/legomushroom/repos/**/gen*/**/*common*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/**/gen*/**/my*.md',
                            '/Users/legomushroom/repos/**/gen*/**/*specific*.md',
                            '/Users/legomushroom/repos/**/gen*/**/*common*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/**/gen*/**/my*.md',
                            '/Users/legomushroom/repos/**/gen*/**/specific*',
                            '/Users/legomushroom/repos/**/gen*/**/unspecific*',
                            '/Users/legomushroom/repos/**/gen*/**/common*',
                            '/Users/legomushroom/repos/**/gen*/**/uncommon*',
                        ],
                        [
                            '/Users/legomushroom/repos/**/gen*/**/my.prompt.md',
                            '/Users/legomushroom/repos/**/gen*/**/specific.prompt.md',
                            '/Users/legomushroom/repos/**/gen*/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/**/gen*/**/unspecific2.prompt.md',
                            '/Users/legomushroom/repos/**/gen*/**/common.prompt.md',
                            '/Users/legomushroom/repos/**/gen*/**/uncommon-10.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/gen/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md',
                            '/Users/legomushroom/repos/prompts/general/common.prompt.md',
                            '/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/gen/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/*specific*',
                            '/Users/legomushroom/repos/prompts/general/*common*',
                        ],
                        [
                            '/Users/legomushroom/repos/vscode/gen/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/**/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/**/unspecific2.prompt.md',
                            '/Users/legomushroom/repos/prompts/general/*',
                        ],
                        [
                            '/Users/legomushroom/repos/**/{gen,general}/**/my.prompt.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/*specific*',
                            '/Users/legomushroom/repos/**/{gen,general}/**/*common*',
                        ],
                        [
                            '/Users/legomushroom/repos/**/{gen,general}/**/my.prompt.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/*specific*.prompt.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/*common*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/**/{gen,general}/**/my*.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/*specific*.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/*common*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/**/{gen,general}/**/my*.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/specific*',
                            '/Users/legomushroom/repos/**/{gen,general}/**/unspecific*',
                            '/Users/legomushroom/repos/**/{gen,general}/**/common*',
                            '/Users/legomushroom/repos/**/{gen,general}/**/uncommon*',
                        ],
                        [
                            '/Users/legomushroom/repos/**/{gen,general}/**/my.prompt.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/specific.prompt.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/unspecific2.prompt.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/common.prompt.md',
                            '/Users/legomushroom/repos/**/{gen,general}/**/uncommon-10.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my.prompt.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*specific*',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*common*',
                        ],
                        [
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my.prompt.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*specific*.prompt.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*common*.prompt.md',
                        ],
                        [
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my*.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*specific*.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/*common*.md',
                        ],
                        [
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my*.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/specific*',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/unspecific*',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/common*',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/uncommon*',
                        ],
                        [
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/my.prompt.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/specific.prompt.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/unspecific2.prompt.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/common.prompt.md',
                            '/Users/legomushroom/repos/{prompts,vscode,copilot}/{gen,general}/**/uncommon-10.prompt.md',
                        ],
                    ];
                    for (const settings of testSettings) {
                        const vscodeSettings = {};
                        for (const setting of settings) {
                            vscodeSettings[setting] = true;
                        }
                        const locator = await createPromptsLocator(vscodeSettings, [
                            '/Users/legomushroom/repos/vscode',
                            '/Users/legomushroom/repos/prompts',
                        ], [
                            {
                                name: '/Users/legomushroom/repos/vscode',
                                children: [
                                    {
                                        name: 'gen/text',
                                        children: [
                                            {
                                                name: 'my.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'nested',
                                                children: [
                                                    {
                                                        name: 'specific.prompt.md',
                                                        contents: 'oh hi, bot!',
                                                    },
                                                    {
                                                        name: 'unspecific1.prompt.md',
                                                        contents: 'oh hi, robot!',
                                                    },
                                                    {
                                                        name: 'unspecific2.prompt.md',
                                                        contents: 'oh hi, rabot!',
                                                    },
                                                    {
                                                        name: 'readme.md',
                                                        contents: 'non prompt file',
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                            {
                                name: '/Users/legomushroom/repos/prompts',
                                children: [
                                    {
                                        name: 'general',
                                        children: [
                                            {
                                                name: 'common.prompt.md',
                                                contents: 'oh hi, bot!',
                                            },
                                            {
                                                name: 'uncommon-10.prompt.md',
                                                contents: 'oh hi, robot!',
                                            },
                                            {
                                                name: 'license.md',
                                                contents: 'non prompt file',
                                            },
                                        ],
                                    }
                                ],
                            },
                        ]);
                        assertOutcome(await locator.listFiles(PromptsType.prompt, PromptsStorage.local, CancellationToken.None), [
                            '/Users/legomushroom/repos/vscode/gen/text/my.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/specific.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific1.prompt.md',
                            '/Users/legomushroom/repos/vscode/gen/text/nested/unspecific2.prompt.md',
                            // -
                            '/Users/legomushroom/repos/prompts/general/common.prompt.md',
                            '/Users/legomushroom/repos/prompts/general/uncommon-10.prompt.md',
                        ], 'Must find correct prompts.');
                        await locator.disposeAsync();
                    }
                });
            });
        });
    });
    suite('isValidGlob', () => {
        testT('valid patterns', async () => {
            const globs = [
                '**',
                '\*',
                '\**',
                '**/*',
                '**/*.prompt.md',
                '/Users/legomushroom/**/*.prompt.md',
                '/Users/legomushroom/*.prompt.md',
                '/Users/legomushroom/*',
                '/Users/legomushroom/repos/{repo1,test}',
                '/Users/legomushroom/repos/{repo1,test}/**',
                '/Users/legomushroom/repos/{repo1,test}/*',
                '/Users/legomushroom/**/{repo1,test}/**',
                '/Users/legomushroom/**/{repo1,test}',
                '/Users/legomushroom/**/{repo1,test}/*',
                '/Users/legomushroom/**/repo[1,2,3]',
                '/Users/legomushroom/**/repo[1,2,3]/**',
                '/Users/legomushroom/**/repo[1,2,3]/*',
                '/Users/legomushroom/**/repo[1,2,3]/**/*.prompt.md',
                'repo[1,2,3]/**/*.prompt.md',
                'repo[[1,2,3]/**/*.prompt.md',
                '{repo1,test}/*.prompt.md',
                '{repo1,test}/*',
                '/{repo1,test}/*',
                '/{repo1,test}}/*',
            ];
            for (const glob of globs) {
                assert((isValidGlob(glob) === true), `'${glob}' must be a 'valid' glob pattern.`);
            }
        });
        testT('invalid patterns', async () => {
            const globs = [
                '.',
                '\\*',
                '\\?',
                '\\*\\?\\*',
                'repo[1,2,3',
                'repo1,2,3]',
                'repo\\[1,2,3]',
                'repo[1,2,3\\]',
                'repo\\[1,2,3\\]',
                '{repo1,repo2',
                'repo1,repo2}',
                '\\{repo1,repo2}',
                '{repo1,repo2\\}',
                '\\{repo1,repo2\\}',
                '/Users/legomushroom/repos',
                '/Users/legomushroom/repo[1,2,3',
                '/Users/legomushroom/repo1,2,3]',
                '/Users/legomushroom/repo\\[1,2,3]',
                '/Users/legomushroom/repo[1,2,3\\]',
                '/Users/legomushroom/repo\\[1,2,3\\]',
                '/Users/legomushroom/{repo1,repo2',
                '/Users/legomushroom/repo1,repo2}',
                '/Users/legomushroom/\\{repo1,repo2}',
                '/Users/legomushroom/{repo1,repo2\\}',
                '/Users/legomushroom/\\{repo1,repo2\\}',
            ];
            for (const glob of globs) {
                assert((isValidGlob(glob) === false), `'${glob}' must be an 'invalid' glob pattern.`);
            }
        });
    });
    suite('getConfigBasedSourceFolders', () => {
        testT('gets unambiguous list of folders', async () => {
            const locator = await createPromptsLocator({
                '.github/prompts': true,
                '/Users/**/repos/**': true,
                'gen/text/**': true,
                'gen/text/nested/*.prompt.md': true,
                'general/*': true,
                '/Users/legomushroom/repos/vscode/my-prompts': true,
                '/Users/legomushroom/repos/vscode/your-prompts/*.md': true,
                '/Users/legomushroom/repos/prompts/shared-prompts/*': true,
            }, [
                '/Users/legomushroom/repos/vscode',
                '/Users/legomushroom/repos/prompts',
            ], []);
            assertOutcome(locator.getConfigBasedSourceFolders(PromptsType.prompt), [
                '/Users/legomushroom/repos/vscode/.github/prompts',
                '/Users/legomushroom/repos/prompts/.github/prompts',
                '/Users/legomushroom/repos/vscode/gen/text/nested',
                '/Users/legomushroom/repos/prompts/gen/text/nested',
                '/Users/legomushroom/repos/vscode/general',
                '/Users/legomushroom/repos/prompts/general',
                '/Users/legomushroom/repos/vscode/my-prompts',
                '/Users/legomushroom/repos/vscode/your-prompts',
                '/Users/legomushroom/repos/prompts/shared-prompts',
            ], 'Must find correct prompts.');
            await locator.disposeAsync();
        });
    });
});
function assertOutcome(actual, expected, message) {
    assert.deepStrictEqual(actual.map((uri) => uri.path), expected, message);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZXNMb2NhdG9yLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9wcm9tcHRTeW50YXgvdXRpbHMvcHJvbXB0RmlsZXNMb2NhdG9yLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN2RixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3pHLE9BQU8sRUFBMkIscUJBQXFCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUNySSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbkYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDBFQUEwRSxDQUFDO0FBQ3RILE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHFGQUFxRixDQUFDO0FBQy9ILE9BQU8sRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDOUYsT0FBTyxFQUFjLHdCQUF3QixFQUFvQixNQUFNLDZEQUE2RCxDQUFDO0FB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