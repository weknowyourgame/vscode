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
import { URI } from '../../../../../../../base/common/uri.js';
import { VSBuffer } from '../../../../../../../base/common/buffer.js';
import { IFileService } from '../../../../../../../platform/files/common/files.js';
import { dirname } from '../../../../../../../base/common/resources.js';
/**
 * Creates mock filesystem from provided file entries.
 * @param fileService File service instance
 * @param files Array of file entries with path and contents
 */
export function mockFiles(fileService, files, parentFolder) {
    return new MockFilesystem(files, fileService).mock(parentFolder);
}
/**
 * Utility to recursively creates provided filesystem structure.
 */
let MockFilesystem = class MockFilesystem {
    constructor(input, fileService) {
        this.input = input;
        this.fileService = fileService;
        this.createdFiles = [];
        this.createdFolders = [];
        this.createdRootFolders = [];
    }
    /**
     * Starts the mock process.
     */
    async mock(parentFolder) {
        // Check if input is the new simplified format
        if (this.input.length > 0 && 'path' in this.input[0]) {
            return this.mockFromFileEntries(this.input);
        }
        // Use the old format
        return this.mockFromFolders(this.input, parentFolder);
    }
    /**
     * Mock using the new simplified file entry format.
     */
    async mockFromFileEntries(fileEntries) {
        // Create all files and their parent directories
        for (const fileEntry of fileEntries) {
            const fileUri = URI.file(fileEntry.path);
            // Ensure parent directories exist
            await this.ensureParentDirectories(dirname(fileUri));
            // Create the file
            const contents = fileEntry.contents.join('\n');
            await this.fileService.writeFile(fileUri, VSBuffer.fromString(contents));
            this.createdFiles.push(fileUri);
        }
    }
    /**
     * Mock using the old nested folder format.
     */
    async mockFromFolders(folders, parentFolder) {
        const result = await Promise.all(folders.map((folder) => this.mockFolder(folder, parentFolder)));
        this.createdRootFolders.push(...result);
    }
    async delete() {
        // Delete files created by the new format
        for (const fileUri of this.createdFiles) {
            if (await this.fileService.exists(fileUri)) {
                await this.fileService.del(fileUri, { useTrash: false });
            }
        }
        for (const folderUri of this.createdFolders.reverse()) { // reverse to delete children first
            if (await this.fileService.exists(folderUri)) {
                await this.fileService.del(folderUri, { recursive: true, useTrash: false });
            }
        }
        // Delete root folders created by the old format
        for (const folder of this.createdRootFolders) {
            await this.fileService.del(folder, { recursive: true, useTrash: false });
        }
    }
    /**
     * The internal implementation of the filesystem mocking process for the old format.
     */
    async mockFolder(folder, parentFolder) {
        const folderUri = parentFolder
            ? URI.joinPath(parentFolder, folder.name)
            : URI.file(folder.name);
        if (!(await this.fileService.exists(folderUri))) {
            try {
                await this.fileService.createFolder(folderUri);
            }
            catch (error) {
                throw new Error(`Failed to create folder '${folderUri.fsPath}': ${error}.`);
            }
        }
        const resolvedChildren = [];
        for (const child of folder.children) {
            const childUri = URI.joinPath(folderUri, child.name);
            // create child file
            if ('contents' in child) {
                const contents = (typeof child.contents === 'string')
                    ? child.contents
                    : child.contents.join('\n');
                await this.fileService.writeFile(childUri, VSBuffer.fromString(contents));
                resolvedChildren.push(childUri);
                continue;
            }
            // recursively create child filesystem structure
            resolvedChildren.push(await this.mockFolder(child, folderUri));
        }
        return folderUri;
    }
    /**
     * Ensures that all parent directories of the given file URI exist.
     */
    async ensureParentDirectories(dirUri) {
        if (!await this.fileService.exists(dirUri)) {
            if (dirUri.path === '/') {
                try {
                    await this.fileService.createFolder(dirUri);
                    this.createdFolders.push(dirUri);
                }
                catch (error) {
                    throw new Error(`Failed to create directory '${dirUri.toString()}': ${error}.`);
                }
            }
            else {
                await this.ensureParentDirectories(dirname(dirUri));
            }
        }
    }
};
MockFilesystem = __decorate([
    __param(1, IFileService)
], MockFilesystem);
export { MockFilesystem };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0ZpbGVzeXN0ZW0uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9wcm9tcHRTeW50YXgvdGVzdFV0aWxzL21vY2tGaWxlc3lzdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDdEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQWdDeEU7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxTQUFTLENBQUMsV0FBeUIsRUFBRSxLQUF1QixFQUFFLFlBQWtCO0lBQy9GLE9BQU8sSUFBSSxjQUFjLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUNsRSxDQUFDO0FBRUQ7O0dBRUc7QUFDSSxJQUFNLGNBQWMsR0FBcEIsTUFBTSxjQUFjO0lBTTFCLFlBQ2tCLEtBQXVDLEVBQzFDLFdBQTBDO1FBRHZDLFVBQUssR0FBTCxLQUFLLENBQWtDO1FBQ3pCLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBTmpELGlCQUFZLEdBQVUsRUFBRSxDQUFDO1FBQ3pCLG1CQUFjLEdBQVUsRUFBRSxDQUFDO1FBQzNCLHVCQUFrQixHQUFVLEVBQUUsQ0FBQztJQUtuQyxDQUFDO0lBSUw7O09BRUc7SUFDSSxLQUFLLENBQUMsSUFBSSxDQUFDLFlBQWtCO1FBQ25DLDhDQUE4QztRQUM5QyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxNQUFNLElBQUksSUFBSSxDQUFDLEtB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