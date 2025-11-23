/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { mockFiles, MockFilesystem } from './mockFilesystem.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { Schemas } from '../../../../../../../base/common/network.js';
import { assertDefined } from '../../../../../../../base/common/types.js';
import { FileService } from '../../../../../../../platform/files/common/fileService.js';
import { ILogService, NullLogService } from '../../../../../../../platform/log/common/log.js';
import { IFileService } from '../../../../../../../platform/files/common/files.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { InMemoryFileSystemProvider } from '../../../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { TestInstantiationService } from '../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
/**
 * Validates that file at {@link filePath} has expected attributes.
 */
async function validateFile(filePath, expectedFile, fileService) {
    let readFile;
    try {
        readFile = await fileService.resolve(URI.file(filePath));
    }
    catch (error) {
        throw new Error(`Failed to read file '${filePath}': ${error}.`);
    }
    assert.strictEqual(readFile.name, expectedFile.name, `File '${filePath}' must have correct 'name'.`);
    assert.deepStrictEqual(readFile.resource, expectedFile.resource, `File '${filePath}' must have correct 'URI'.`);
    assert.strictEqual(readFile.isFile, expectedFile.isFile, `File '${filePath}' must have correct 'isFile' value.`);
    assert.strictEqual(readFile.isDirectory, expectedFile.isDirectory, `File '${filePath}' must have correct 'isDirectory' value.`);
    assert.strictEqual(readFile.isSymbolicLink, expectedFile.isSymbolicLink, `File '${filePath}' must have correct 'isSymbolicLink' value.`);
    assert.strictEqual(readFile.children, undefined, `File '${filePath}' must not have children.`);
    const fileContents = await fileService.readFile(readFile.resource);
    assert.strictEqual(fileContents.value.toString(), expectedFile.contents, `File '${expectedFile.resource.fsPath}' must have correct contents.`);
}
/**
 * Validates that folder at {@link folderPath} has expected attributes.
 */
async function validateFolder(folderPath, expectedFolder, fileService) {
    let readFolder;
    try {
        readFolder = await fileService.resolve(URI.file(folderPath));
    }
    catch (error) {
        throw new Error(`Failed to read folder '${folderPath}': ${error}.`);
    }
    assert.strictEqual(readFolder.name, expectedFolder.name, `Folder '${folderPath}' must have correct 'name'.`);
    assert.deepStrictEqual(readFolder.resource, expectedFolder.resource, `Folder '${folderPath}' must have correct 'URI'.`);
    assert.strictEqual(readFolder.isFile, expectedFolder.isFile, `Folder '${folderPath}' must have correct 'isFile' value.`);
    assert.strictEqual(readFolder.isDirectory, expectedFolder.isDirectory, `Folder '${folderPath}' must have correct 'isDirectory' value.`);
    assert.strictEqual(readFolder.isSymbolicLink, expectedFolder.isSymbolicLink, `Folder '${folderPath}' must have correct 'isSymbolicLink' value.`);
    assertDefined(readFolder.children, `Folder '${folderPath}' must have children.`);
    assert.strictEqual(readFolder.children.length, expectedFolder.children.length, `Folder '${folderPath}' must have correct number of children.`);
    for (const expectedChild of expectedFolder.children) {
        const childPath = URI.joinPath(expectedFolder.resource, expectedChild.name).fsPath;
        if ('children' in expectedChild) {
            await validateFolder(childPath, expectedChild, fileService);
            continue;
        }
        await validateFile(childPath, expectedChild, fileService);
    }
}
suite('MockFilesystem', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let fileService;
    setup(async () => {
        instantiationService = disposables.add(new TestInstantiationService());
        instantiationService.stub(ILogService, new NullLogService());
        fileService = disposables.add(instantiationService.createInstance(FileService));
        const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
        disposables.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
        instantiationService.stub(IFileService, fileService);
    });
    test('mocks file structure using new simplified format', async () => {
        const mockFilesystem = instantiationService.createInstance(MockFilesystem, [
            {
                path: '/root/folder/file.txt',
                contents: ['contents']
            },
            {
                path: '/root/folder/Subfolder/test.ts',
                contents: ['other contents']
            },
            {
                path: '/root/folder/Subfolder/file.test.ts',
                contents: ['hello test']
            },
            {
                path: '/root/folder/Subfolder/.file-2.TEST.ts',
                contents: ['test hello']
            }
        ]);
        await mockFilesystem.mock();
        /**
         * Validate files and folders next.
         */
        await validateFolder('/root/folder', {
            resource: URI.file('/root/folder'),
            name: 'folder',
            isFile: false,
            isDirectory: true,
            isSymbolicLink: false,
            children: [
                {
                    resource: URI.file('/root/folder/file.txt'),
                    name: 'file.txt',
                    isFile: true,
                    isDirectory: false,
                    isSymbolicLink: false,
                    contents: 'contents',
                },
                {
                    resource: URI.file('/root/folder/Subfolder'),
                    name: 'Subfolder',
                    isFile: false,
                    isDirectory: true,
                    isSymbolicLink: false,
                    children: [
                        {
                            resource: URI.file('/root/folder/Subfolder/test.ts'),
                            name: 'test.ts',
                            isFile: true,
                            isDirectory: false,
                            isSymbolicLink: false,
                            contents: 'other contents',
                        },
                        {
                            resource: URI.file('/root/folder/Subfolder/file.test.ts'),
                            name: 'file.test.ts',
                            isFile: true,
                            isDirectory: false,
                            isSymbolicLink: false,
                            contents: 'hello test',
                        },
                        {
                            resource: URI.file('/root/folder/Subfolder/.file-2.TEST.ts'),
                            name: '.file-2.TEST.ts',
                            isFile: true,
                            isDirectory: false,
                            isSymbolicLink: false,
                            contents: 'test hello',
                        },
                    ],
                }
            ],
        }, fileService);
    });
    test('can be created using static factory method', async () => {
        await mockFiles(fileService, [
            {
                path: '/simple/test.txt',
                contents: ['line 1', 'line 2', 'line 3']
            }
        ]);
        await validateFile('/simple/test.txt', {
            resource: URI.file('/simple/test.txt'),
            name: 'test.txt',
            isFile: true,
            isDirectory: false,
            isSymbolicLink: false,
            contents: 'line 1\nline 2\nline 3',
        }, fileService);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0ZpbGVzeXN0ZW0udGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC90ZXN0VXRpbHMvbW9ja0ZpbGVzeXN0ZW0udGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNoRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDeEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsWUFBWSxFQUFhLE1BQU0scURBQXFELENBQUM7QUFDOUYsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDekcsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sMEVBQTBFLENBQUM7QUFDdEgsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0scUZBQXFGLENBQUM7QUE4Qi9IOztHQUVHO0FBQ0gsS0FBSyxVQUFVLFlBQVksQ0FDMUIsUUFBZ0IsRUFDaEIsWUFBMkIsRUFDM0IsV0FBeUI7SUFFekIsSUFBSSxRQUErQixDQUFDO0lBQ3BDLElBQUksQ0FBQztRQUNKLFFBQVEsR0FBRyxNQUFNLFdBQVcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFD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