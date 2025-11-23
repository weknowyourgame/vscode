/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import assert from 'assert';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { ConfigurationService } from '../../../../../../platform/configuration/common/configurationService.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { FileService } from '../../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../../platform/log/common/log.js';
import { NullPolicyService } from '../../../../../../platform/policy/common/policy.js';
import { ChatModeKind } from '../../../common/constants.js';
import { getPromptFileType } from '../../../common/promptSyntax/config/promptFileLocations.js';
import { PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { MockFilesystem } from './testUtils/mockFilesystem.js';
import { PromptFileParser } from '../../../common/promptSyntax/promptFileParser.js';
/**
 * Represents a file reference with an expected
 * error condition value for testing purposes.
 */
class ExpectedReference {
    constructor(dirname, ref) {
        this.ref = ref;
        this.uri = (ref.content.startsWith('/'))
            ? URI.file(ref.content)
            : URI.joinPath(dirname, ref.content);
    }
    /**
     * Range of the underlying file reference token.
     */
    get range() {
        return this.ref.range;
    }
    /**
     * String representation of the expected reference.
     */
    toString() {
        return `file-prompt:${this.uri.path}`;
    }
}
function toUri(filePath) {
    return URI.parse('testFs://' + filePath);
}
/**
 * A reusable test utility to test the `PromptFileReference` class.
 */
let TestPromptFileReference = class TestPromptFileReference extends Disposable {
    constructor(fileStructure, rootFileUri, expectedReferences, fileService, instantiationService) {
        super();
        this.fileStructure = fileStructure;
        this.rootFileUri = rootFileUri;
        this.expectedReferences = expectedReferences;
        this.fileService = fileService;
        this.instantiationService = instantiationService;
        // create in-memory file system
        const fileSystemProvider = this._register(new InMemoryFileSystemProvider());
        this._register(this.fileService.registerProvider('testFs', fileSystemProvider));
    }
    /**
     * Run the test.
     */
    async run() {
        // create the files structure on the disk
        const mockFs = this.instantiationService.createInstance(MockFilesystem, this.fileStructure);
        await mockFs.mock(toUri('/'));
        const content = await this.fileService.readFile(this.rootFileUri);
        const ast = new PromptFileParser().parse(this.rootFileUri, content.value.toString());
        assert(ast.body, 'Prompt file must have a body');
        // resolve the root file reference including all nested references
        const resolvedReferences = ast.body.fileReferences ?? [];
        for (let i = 0; i < this.expectedReferences.length; i++) {
            const expectedReference = this.expectedReferences[i];
            const resolvedReference = resolvedReferences[i];
            const resolvedUri = ast.body.resolveFilePath(resolvedReference.content);
            assert.equal(resolvedUri?.fsPath, expectedReference.uri.fsPath);
            assert.deepStrictEqual(resolvedReference.range, expectedReference.range);
        }
        assert.strictEqual(resolvedReferences.length, this.expectedReferences.length, [
            `\nExpected(${this.expectedReferences.length}): [\n ${this.expectedReferences.join('\n ')}\n]`,
            `Received(${resolvedReferences.length}): [\n ${resolvedReferences.join('\n ')}\n]`,
        ].join('\n'));
        const result = {};
        result.promptType = getPromptFileType(this.rootFileUri);
        if (ast.header) {
            for (const key of ['tools', 'model', 'agent', 'applyTo', 'description']) {
                if (ast.header[key]) {
                    result[key] = ast.header[key];
                }
            }
        }
        await mockFs.delete();
        return result;
    }
};
TestPromptFileReference = __decorate([
    __param(3, IFileService),
    __param(4, IInstantiationService)
], TestPromptFileReference);
/**
 * Create expected file reference for testing purposes.
 *
 * Note! This utility also use for `markdown links` at the moment.
 *
 * @param filePath The expected path of the file reference (without the `#file:` prefix).
 * @param lineNumber The expected line number of the file reference.
 * @param startColumnNumber The expected start column number of the file reference.
 */
function createFileReference(filePath, lineNumber, startColumnNumber) {
    const range = new Range(lineNumber, startColumnNumber + '#file:'.length, lineNumber, startColumnNumber + '#file:'.length + filePath.length);
    return {
        range,
        content: filePath,
        isMarkdownLink: false,
    };
}
function createMarkdownReference(lineNumber, startColumnNumber, firstSeg, secondSeg) {
    const range = new Range(lineNumber, startColumnNumber + firstSeg.length + 1, lineNumber, startColumnNumber + firstSeg.length + secondSeg.length - 1);
    return {
        range,
        content: secondSeg.substring(1, secondSeg.length - 1),
        isMarkdownLink: true,
    };
}
suite('PromptFileReference', function () {
    const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    setup(async () => {
        const nullPolicyService = new NullPolicyService();
        const nullLogService = testDisposables.add(new NullLogService());
        const nullFileService = testDisposables.add(new FileService(nullLogService));
        const nullConfigService = testDisposables.add(new ConfigurationService(URI.file('/config.json'), nullFileService, nullPolicyService, nullLogService));
        instantiationService = testDisposables.add(new TestInstantiationService());
        instantiationService.stub(IFileService, nullFileService);
        instantiationService.stub(ILogService, nullLogService);
        instantiationService.stub(IConfigurationService, nullConfigService);
        instantiationService.stub(IModelService, { getModel() { return null; } });
        instantiationService.stub(ILanguageService, {
            guessLanguageIdByFilepathOrFirstLine(uri) {
                return getPromptFileType(uri) ?? null;
            }
        });
    });
    test('resolves nested file references', async function () {
        const rootFolderName = 'resolves-nested-file-references';
        const rootFolder = `/${rootFolderName}`;
        const rootUri = toUri(rootFolder);
        const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
        /**
         * The file structure to be created on the disk for the test.
         */
        [{
                name: rootFolderName,
                children: [
                    {
                        name: 'file1.prompt.md',
                        contents: '## Some Header\nsome contents\n ',
                    },
                    {
                        name: 'file2.prompt.md',
                        contents: '## Files\n\t- this file #file:folder1/file3.prompt.md \n\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!\n ',
                    },
                    {
                        name: 'folder1',
                        children: [
                            {
                                name: 'file3.prompt.md',
                                contents: `\n[](./some-other-folder/non-existing-folder)\n\t- some seemingly random #file:${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md contents\n some more\t content`,
                            },
                            {
                                name: 'some-other-folder',
                                children: [
                                    {
                                        name: 'file4.prompt.md',
                                        contents: 'this file has a non-existing #file:./some-non-existing/file.prompt.md\t\treference\n\n\nand some\n non-prompt #file:./some-non-prompt-file.md\t\t \t[](../../folder1/)\t',
                                    },
                                    {
                                        name: 'file.txt',
                                        contents: 'contents of a non-prompt-snippet file',
                                    },
                                    {
                                        name: 'yetAnotherFolder🤭',
                                        children: [
                                            {
                                                name: 'another-file.prompt.md',
                                                contents: `[caption](${rootFolder}/folder1/some-other-folder)\nanother-file.prompt.md contents\t [#file:file.txt](../file.txt)`,
                                            },
                                            {
                                                name: 'one_more_file_just_in_case.prompt.md',
                                                contents: 'one_more_file_just_in_case.prompt.md contents',
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }], 
        /**
         * The root file path to start the resolve process from.
         */
        toUri(`/${rootFolderName}/file2.prompt.md`), 
        /**
         * The expected references to be resolved.
         */
        [
            new ExpectedReference(rootUri, createFileReference('folder1/file3.prompt.md', 2, 14)),
            new ExpectedReference(rootUri, createMarkdownReference(3, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
        ]));
        await test.run();
    });
    suite('metadata', () => {
        test('tools', async function () {
            const rootFolderName = 'resolves-nested-file-references';
            const rootFolder = `/${rootFolderName}`;
            const rootUri = toUri(rootFolder);
            const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
            /**
             * The file structure to be created on the disk for the test.
             */
            [{
                    name: rootFolderName,
                    children: [
                        {
                            name: 'file1.prompt.md',
                            contents: [
                                '## Some Header',
                                'some contents',
                                ' ',
                            ],
                        },
                        {
                            name: 'file2.prompt.md',
                            contents: [
                                '---',
                                'description: \'Root prompt description.\'',
                                'tools: [\'my-tool1\']',
                                'agent: "agent" ',
                                '---',
                                '## Files',
                                '\t- this file #file:folder1/file3.prompt.md ',
                                '\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!',
                                ' ',
                            ],
                        },
                        {
                            name: 'folder1',
                            children: [
                                {
                                    name: 'file3.prompt.md',
                                    contents: [
                                        '---',
                                        'tools: [ false, \'my-tool1\' , ]',
                                        '---',
                                        '',
                                        '[](./some-other-folder/non-existing-folder)',
                                        `\t- some seemingly random #file:${rootFolder}/folder1/some-other-folder/yetAnotherFolder🤭/another-file.prompt.md contents`,
                                        ' some more\t content',
                                    ],
                                },
                                {
                                    name: 'some-other-folder',
                                    children: [
                                        {
                                            name: 'file4.prompt.md',
                                            contents: [
                                                '---',
                                                'tools: [\'my-tool1\', "my-tool2", true, , ]',
                                                'something: true',
                                                'agent: \'ask\'\t',
                                                '---',
                                                'this file has a non-existing #file:./some-non-existing/file.prompt.md\t\treference',
                                                '',
                                                '',
                                                'and some',
                                                ' non-prompt #file:./some-non-prompt-file.md\t\t \t[](../../folder1/)\t',
                                            ],
                                        },
                                        {
                                            name: 'file.txt',
                                            contents: 'contents of a non-prompt-snippet file',
                                        },
                                        {
                                            name: 'yetAnotherFolder🤭',
                                            children: [
                                                {
                                                    name: 'another-file.prompt.md',
                                                    contents: [
                                                        '---',
                                                        'tools: [\'my-tool3\', false, "my-tool2" ]',
                                                        '---',
                                                        `[](${rootFolder}/folder1/some-other-folder)`,
                                                        'another-file.prompt.md contents\t [#file:file.txt](../file.txt)',
                                                    ],
                                                },
                                                {
                                                    name: 'one_more_file_just_in_case.prompt.md',
                                                    contents: 'one_more_file_just_in_case.prompt.md contents',
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }], 
            /**
             * The root file path to start the resolve process from.
             */
            toUri(`/${rootFolderName}/file2.prompt.md`), 
            /**
             * The expected references to be resolved.
             */
            [
                new ExpectedReference(rootUri, createFileReference('folder1/file3.prompt.md', 7, 14)),
                new ExpectedReference(rootUri, createMarkdownReference(8, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
            ]));
            const metadata = await test.run();
            assert.deepStrictEqual(metadata, {
                promptType: PromptsType.prompt,
                agent: 'agent',
                description: 'Root prompt description.',
                tools: ['my-tool1'],
            }, 'Must have correct metadata.');
        });
        suite('applyTo', () => {
            test('prompt language', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = toUri(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
                [{
                        name: rootFolderName,
                        children: [
                            {
                                name: 'file1.prompt.md',
                                contents: [
                                    '## Some Header',
                                    'some contents',
                                    ' ',
                                ],
                            },
                            {
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'applyTo: \'**/*\'',
                                    'tools: [ false, \'my-tool12\' , ]',
                                    'description: \'Description of my prompt.\'',
                                    '---',
                                    '## Files',
                                    '\t- this file #file:folder1/file3.prompt.md ',
                                    '\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!',
                                    ' ',
                                ],
                            },
                            {
                                name: 'folder1',
                                children: [
                                    {
                                        name: 'file3.prompt.md',
                                        contents: [
                                            '---',
                                            'tools: [ false, \'my-tool1\' , ]',
                                            '---',
                                            ' some more\t content',
                                        ],
                                    },
                                    {
                                        name: 'some-other-folder',
                                        children: [
                                            {
                                                name: 'file4.prompt.md',
                                                contents: [
                                                    '---',
                                                    'tools: [\'my-tool1\', "my-tool2", true, , \'my-tool3\' , ]',
                                                    'something: true',
                                                    'agent: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                toUri(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createFileReference('folder1/file3.prompt.md', 7, 14)),
                    new ExpectedReference(rootUri, createMarkdownReference(8, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const metadata = await test.run();
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    description: 'Description of my prompt.',
                    tools: ['my-tool12'],
                    applyTo: '**/*',
                }, 'Must have correct metadata.');
            });
            test('instructions language', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = toUri(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
                [{
                        name: rootFolderName,
                        children: [
                            {
                                name: 'file1.prompt.md',
                                contents: [
                                    '## Some Header',
                                    'some contents',
                                    ' ',
                                ],
                            },
                            {
                                name: 'file2.instructions.md',
                                contents: [
                                    '---',
                                    'applyTo: \'**/*\'',
                                    'tools: [ false, \'my-tool12\' , ]',
                                    'description: \'Description of my instructions file.\'',
                                    '---',
                                    '## Files',
                                    '\t- this file #file:folder1/file3.prompt.md ',
                                    '\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!',
                                    ' ',
                                ],
                            },
                            {
                                name: 'folder1',
                                children: [
                                    {
                                        name: 'file3.prompt.md',
                                        contents: [
                                            '---',
                                            'tools: [ false, \'my-tool1\' , ]',
                                            '---',
                                            ' some more\t content',
                                        ],
                                    },
                                    {
                                        name: 'some-other-folder',
                                        children: [
                                            {
                                                name: 'file4.prompt.md',
                                                contents: [
                                                    '---',
                                                    'tools: [\'my-tool1\', "my-tool2", true, , \'my-tool3\' , ]',
                                                    'something: true',
                                                    'agent: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                toUri(`/${rootFolderName}/file2.instructions.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createFileReference('folder1/file3.prompt.md', 7, 14)),
                    new ExpectedReference(rootUri, createMarkdownReference(8, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const metadata = await test.run();
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.instructions,
                    applyTo: '**/*',
                    description: 'Description of my instructions file.',
                    tools: ['my-tool12'],
                }, 'Must have correct metadata.');
            });
        });
        suite('tools and agent compatibility', () => {
            test('ask agent', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = toUri(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
                [{
                        name: rootFolderName,
                        children: [
                            {
                                name: 'file1.prompt.md',
                                contents: [
                                    '## Some Header',
                                    'some contents',
                                    ' ',
                                ],
                            },
                            {
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'description: \'Description of my prompt.\'',
                                    'agent: "ask" ',
                                    '---',
                                    '## Files',
                                    '\t- this file #file:folder1/file3.prompt.md ',
                                    '\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!',
                                    ' ',
                                ],
                            },
                            {
                                name: 'folder1',
                                children: [
                                    {
                                        name: 'file3.prompt.md',
                                        contents: [
                                            '---',
                                            'tools: [ false, \'my-tool1\' , ]',
                                            'agent: \'agent\'\t',
                                            '---',
                                            ' some more\t content',
                                        ],
                                    },
                                    {
                                        name: 'some-other-folder',
                                        children: [
                                            {
                                                name: 'file4.prompt.md',
                                                contents: [
                                                    '---',
                                                    'tools: [\'my-tool1\', "my-tool2", true, , ]',
                                                    'something: true',
                                                    'agent: \'ask\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                toUri(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createFileReference('folder1/file3.prompt.md', 6, 14)),
                    new ExpectedReference(rootUri, createMarkdownReference(7, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const metadata = await test.run();
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    agent: ChatModeKind.Ask,
                    description: 'Description of my prompt.',
                }, 'Must have correct metadata.');
            });
            test('edit agent', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = toUri(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
                [{
                        name: rootFolderName,
                        children: [
                            {
                                name: 'file1.prompt.md',
                                contents: [
                                    '## Some Header',
                                    'some contents',
                                    ' ',
                                ],
                            },
                            {
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'description: \'Description of my prompt.\'',
                                    'agent:\t\t"edit"\t\t',
                                    '---',
                                    '## Files',
                                    '\t- this file #file:folder1/file3.prompt.md ',
                                    '\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!',
                                    ' ',
                                ],
                            },
                            {
                                name: 'folder1',
                                children: [
                                    {
                                        name: 'file3.prompt.md',
                                        contents: [
                                            '---',
                                            'tools: [ false, \'my-tool1\' , ]',
                                            '---',
                                            ' some more\t content',
                                        ],
                                    },
                                    {
                                        name: 'some-other-folder',
                                        children: [
                                            {
                                                name: 'file4.prompt.md',
                                                contents: [
                                                    '---',
                                                    'tools: [\'my-tool1\', "my-tool2", true, , ]',
                                                    'something: true',
                                                    'agent: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                toUri(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createFileReference('folder1/file3.prompt.md', 6, 14)),
                    new ExpectedReference(rootUri, createMarkdownReference(7, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const metadata = await test.run();
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    agent: ChatModeKind.Edit,
                    description: 'Description of my prompt.',
                }, 'Must have correct metadata.');
            });
            test('agent', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = toUri(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
                [{
                        name: rootFolderName,
                        children: [
                            {
                                name: 'file1.prompt.md',
                                contents: [
                                    '## Some Header',
                                    'some contents',
                                    ' ',
                                ],
                            },
                            {
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'description: \'Description of my prompt.\'',
                                    'agent: \t\t "agent" \t\t ',
                                    '---',
                                    '## Files',
                                    '\t- this file #file:folder1/file3.prompt.md ',
                                    '\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!',
                                    ' ',
                                ],
                            },
                            {
                                name: 'folder1',
                                children: [
                                    {
                                        name: 'file3.prompt.md',
                                        contents: [
                                            '---',
                                            'tools: [ false, \'my-tool1\' , ]',
                                            '---',
                                            ' some more\t content',
                                        ],
                                    },
                                    {
                                        name: 'some-other-folder',
                                        children: [
                                            {
                                                name: 'file4.prompt.md',
                                                contents: [
                                                    '---',
                                                    'tools: [\'my-tool1\', "my-tool2", true, , \'my-tool3\' , ]',
                                                    'something: true',
                                                    'agent: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                toUri(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createFileReference('folder1/file3.prompt.md', 6, 14)),
                    new ExpectedReference(rootUri, createMarkdownReference(7, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const metadata = await test.run();
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    agent: ChatModeKind.Agent,
                    description: 'Description of my prompt.',
                }, 'Must have correct metadata.');
            });
            test('no agent', async function () {
                const rootFolderName = 'resolves-nested-file-references';
                const rootFolder = `/${rootFolderName}`;
                const rootUri = toUri(rootFolder);
                const test = testDisposables.add(instantiationService.createInstance(TestPromptFileReference, 
                /**
                 * The file structure to be created on the disk for the test.
                 */
                [{
                        name: rootFolderName,
                        children: [
                            {
                                name: 'file1.prompt.md',
                                contents: [
                                    '## Some Header',
                                    'some contents',
                                    ' ',
                                ],
                            },
                            {
                                name: 'file2.prompt.md',
                                contents: [
                                    '---',
                                    'tools: [ false, \'my-tool12\' , ]',
                                    'description: \'Description of the prompt file.\'',
                                    '---',
                                    '## Files',
                                    '\t- this file #file:folder1/file3.prompt.md ',
                                    '\t- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!',
                                    ' ',
                                ],
                            },
                            {
                                name: 'folder1',
                                children: [
                                    {
                                        name: 'file3.prompt.md',
                                        contents: [
                                            '---',
                                            'tools: [ false, \'my-tool1\' , ]',
                                            '---',
                                            ' some more\t content',
                                        ],
                                    },
                                    {
                                        name: 'some-other-folder',
                                        children: [
                                            {
                                                name: 'file4.prompt.md',
                                                contents: [
                                                    '---',
                                                    'tools: [\'my-tool1\', "my-tool2", true, , \'my-tool3\' , ]',
                                                    'something: true',
                                                    'agent: \'agent\'\t',
                                                    '---',
                                                    '',
                                                    '',
                                                    'and some more content',
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }], 
                /**
                 * The root file path to start the resolve process from.
                 */
                toUri(`/${rootFolderName}/file2.prompt.md`), 
                /**
                 * The expected references to be resolved.
                 */
                [
                    new ExpectedReference(rootUri, createFileReference('folder1/file3.prompt.md', 6, 14)),
                    new ExpectedReference(rootUri, createMarkdownReference(7, 14, '[file4.prompt.md]', '(./folder1/some-other-folder/file4.prompt.md)')),
                ]));
                const metadata = await test.run();
                assert.deepStrictEqual(metadata, {
                    promptType: PromptsType.prompt,
                    tools: ['my-tool12'],
                    description: 'Description of the prompt file.',
                }, 'Must have correct metadata.');
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZVJlZmVyZW5jZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9jb21tb24vcHJvbXB0U3ludGF4L3Byb21wdEZpbGVSZWZlcmVuY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN0RyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDdEUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDekYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHlFQUF5RSxDQUFDO0FBQy9HLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDckYsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sdUVBQXVFLENBQUM7QUFDbkgsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sa0ZBQWtGLENBQUM7QUFDNUgsT0FBTyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUMzRixP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