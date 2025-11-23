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
var BrowserFileUpload_1, FileDownload_1;
import { localize } from '../../../../nls.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { getFileNamesMessage, IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ByteSize, IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IExplorerService } from './files.js';
import { VIEW_ID } from '../common/files.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { Limiter, Promises, RunOnceWorker } from '../../../../base/common/async.js';
import { newWriteableBufferStream, VSBuffer } from '../../../../base/common/buffer.js';
import { basename, dirname, joinPath } from '../../../../base/common/resources.js';
import { ResourceFileEdit } from '../../../../editor/browser/services/bulkEditService.js';
import { ExplorerItem } from '../common/explorerModel.js';
import { URI } from '../../../../base/common/uri.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { extractEditorsAndFilesDropData } from '../../../../platform/dnd/browser/dnd.js';
import { IWorkspaceEditingService } from '../../../services/workspaces/common/workspaceEditing.js';
import { isWeb } from '../../../../base/common/platform.js';
import { getActiveWindow, isDragEvent, triggerDownload } from '../../../../base/browser/dom.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { FileAccess, Schemas } from '../../../../base/common/network.js';
import { listenStream } from '../../../../base/common/stream.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { createSingleCallFunction } from '../../../../base/common/functional.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { canceled } from '../../../../base/common/errors.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { WebFileSystemAccess } from '../../../../platform/files/browser/webFileSystemAccess.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
let BrowserFileUpload = class BrowserFileUpload {
    static { BrowserFileUpload_1 = this; }
    static { this.MAX_PARALLEL_UPLOADS = 20; }
    constructor(progressService, dialogService, explorerService, editorService, fileService) {
        this.progressService = progressService;
        this.dialogService = dialogService;
        this.explorerService = explorerService;
        this.editorService = editorService;
        this.fileService = fileService;
    }
    upload(target, source) {
        const cts = new CancellationTokenSource();
        // Indicate progress globally
        const uploadPromise = this.progressService.withProgress({
            location: 10 /* ProgressLocation.Window */,
            delay: 800,
            cancellable: true,
            title: localize('uploadingFiles', "Uploading")
        }, async (progress) => this.doUpload(target, this.toTransfer(source), progress, cts.token), () => cts.dispose(true));
        // Also indicate progress in the files view
        this.progressService.withProgress({ location: VIEW_ID, delay: 500 }, () => uploadPromise);
        return uploadPromise;
    }
    toTransfer(source) {
        if (isDragEvent(source)) {
            return source.dataTransfer;
        }
        const transfer = { items: [] };
        // We want to reuse the same code for uploading from
        // Drag & Drop as well as input element based upload
        // so we convert into webkit data transfer when the
        // input element approach is used (simplified).
        for (const file of source) {
            transfer.items.push({
                webkitGetAsEntry: () => {
                    return {
                        name: file.name,
                        isDirectory: false,
                        isFile: true,
                        createReader: () => { throw new Error('Unsupported for files'); },
                        file: resolve => resolve(file)
                    };
                }
            });
        }
        return transfer;
    }
    async doUpload(target, source, progress, token) {
        const items = source.items;
        // Somehow the items thing is being modified at random, maybe as a security
        // measure since this is a DND operation. As such, we copy the items into
        // an array we own as early as possible before using it.
        const entries = [];
        for (const item of items) {
            entries.push(item.webkitGetAsEntry());
        }
        const results = [];
        const operation = {
            startTime: Date.now(),
            progressScheduler: new RunOnceWorker(steps => { progress.report(steps[steps.length - 1]); }, 1000),
            filesTotal: entries.length,
            filesUploaded: 0,
            totalBytesUploaded: 0
        };
        // Upload all entries in parallel up to a
        // certain maximum leveraging the `Limiter`
        const uploadLimiter = new Limiter(BrowserFileUpload_1.MAX_PARALLEL_UPLOADS);
        await Promises.settled(entries.map(entry => {
            return uploadLimiter.queue(async () => {
                if (token.isCancellationRequested) {
                    return;
                }
                // Confirm overwrite as needed
                if (target && entry.name && target.getChild(entry.name)) {
                    const { confirmed } = await this.dialogService.confirm(getFileOverwriteConfirm(entry.name));
                    if (!confirmed) {
                        return;
                    }
                    await this.explorerService.applyBulkEdit([new ResourceFileEdit(joinPath(target.resource, entry.name), undefined, { recursive: true, folder: target.getChild(entry.name)?.isDirectory })], {
                        undoLabel: localize('overwrite', "Overwrite {0}", entry.name),
                        progressLabel: localize('overwriting', "Overwriting {0}", entry.name),
                    });
                    if (token.isCancellationRequested) {
                        return;
                    }
                }
                // Upload entry
                const result = await this.doUploadEntry(entry, target.resource, target, progress, operation, token);
                if (result) {
                    results.push(result);
                }
            });
        }));
        operation.progressScheduler.dispose();
        // Open uploaded file in editor only if we upload just one
        const firstUploadedFile = results[0];
        if (!token.isCancellationRequested && firstUploadedFile?.isFile) {
            await this.editorService.openEditor({ resource: firstUploadedFile.resource, options: { pinned: true } });
        }
    }
    async doUploadEntry(entry, parentResource, target, progress, operation, token) {
        if (token.isCancellationRequested || !entry.name || (!entry.isFile && !entry.isDirectory)) {
            return undefined;
        }
        // Report progress
        let fileBytesUploaded = 0;
        const reportProgress = (fileSize, bytesUploaded) => {
            fileBytesUploaded += bytesUploaded;
            operation.totalBytesUploaded += bytesUploaded;
            const bytesUploadedPerSecond = operation.totalBytesUploaded / ((Date.now() - operation.startTime) / 1000);
            // Small file
            let message;
            if (fileSize < ByteSize.MB) {
                if (operation.filesTotal === 1) {
                    message = `${entry.name}`;
                }
                else {
                    message = localize('uploadProgressSmallMany', "{0} of {1} files ({2}/s)", operation.filesUploaded, operation.filesTotal, ByteSize.formatSize(bytesUploadedPerSecond));
                }
            }
            // Large file
            else {
                message = localize('uploadProgressLarge', "{0} ({1} of {2}, {3}/s)", entry.name, ByteSize.formatSize(fileBytesUploaded), ByteSize.formatSize(fileSize), ByteSize.formatSize(bytesUploadedPerSecond));
            }
            // Report progress but limit to update only once per second
            operation.progressScheduler.work({ message });
        };
        operation.filesUploaded++;
        reportProgress(0, 0);
        // Handle file upload
        const resource = joinPath(parentResource, entry.name);
        if (entry.isFile) {
            const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
            if (token.isCancellationRequested) {
                return undefined;
            }
            // Chrome/Edge/Firefox support stream method, but only use it for
            // larger files to reduce the overhead of the streaming approach
            if (typeof file.stream === 'function' && file.size > ByteSize.MB) {
                await this.doUploadFileBuffered(resource, file, reportProgress, token);
            }
            // Fallback to unbuffered upload for other browsers or small files
            else {
                await this.doUploadFileUnbuffered(resource, file, reportProgress);
            }
            return { isFile: true, resource };
        }
        // Handle folder upload
        else {
            // Create target folder
            await this.fileService.createFolder(resource);
            if (token.isCancellationRequested) {
                return undefined;
            }
            // Recursive upload files in this directory
            const dirReader = entry.createReader();
            const childEntries = [];
            let done = false;
            do {
                const childEntriesChunk = await new Promise((resolve, reject) => dirReader.readEntries(resolve, reject));
                if (childEntriesChunk.length > 0) {
                    childEntries.push(...childEntriesChunk);
                }
                else {
                    done = true; // an empty array is a signal that all entries have been read
                }
            } while (!done && !token.isCancellationRequested);
            // Update operation total based on new counts
            operation.filesTotal += childEntries.length;
            // Split up files from folders to upload
            const folderTarget = target?.getChild(entry.name) || undefined;
            const fileChildEntries = [];
            const folderChildEntries = [];
            for (const childEntry of childEntries) {
                if (childEntry.isFile) {
                    fileChildEntries.push(childEntry);
                }
                else if (childEntry.isDirectory) {
                    folderChildEntries.push(childEntry);
                }
            }
            // Upload files (up to `MAX_PARALLEL_UPLOADS` in parallel)
            const fileUploadQueue = new Limiter(BrowserFileUpload_1.MAX_PARALLEL_UPLOADS);
            await Promises.settled(fileChildEntries.map(fileChildEntry => {
                return fileUploadQueue.queue(() => this.doUploadEntry(fileChildEntry, resource, folderTarget, progress, operation, token));
            }));
            // Upload folders (sequentially give we don't know their sizes)
            for (const folderChildEntry of folderChildEntries) {
                await this.doUploadEntry(folderChildEntry, resource, folderTarget, progress, operation, token);
            }
            return { isFile: false, resource };
        }
    }
    async doUploadFileBuffered(resource, file, progressReporter, token) {
        const writeableStream = newWriteableBufferStream({
            // Set a highWaterMark to prevent the stream
            // for file upload to produce large buffers
            // in-memory
            highWaterMark: 10
        });
        const writeFilePromise = this.fileService.writeFile(resource, writeableStream);
        // Read the file in chunks using File.stream() web APIs
        try {
            const reader = file.stream().getReader();
            let res = await reader.read();
            while (!res.done) {
                if (token.isCancellationRequested) {
                    break;
                }
                // Write buffer into stream but make sure to wait
                // in case the `highWaterMark` is reached
                const buffer = VSBuffer.wrap(res.value);
                await writeableStream.write(buffer);
                if (token.isCancellationRequested) {
                    break;
                }
                // Report progress
                progressReporter(file.size, buffer.byteLength);
                res = await reader.read();
            }
            writeableStream.end(undefined);
        }
        catch (error) {
            writeableStream.error(error);
            writeableStream.end();
        }
        if (token.isCancellationRequested) {
            return undefined;
        }
        // Wait for file being written to target
        await writeFilePromise;
    }
    doUploadFileUnbuffered(resource, file, progressReporter) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    if (event.target?.result instanceof ArrayBuffer) {
                        const buffer = VSBuffer.wrap(new Uint8Array(event.target.result));
                        await this.fileService.writeFile(resource, buffer);
                        // Report progress
                        progressReporter(file.size, buffer.byteLength);
                    }
                    else {
                        throw new Error('Could not read from dropped file.');
                    }
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            };
            // Start reading the file to trigger `onload`
            reader.readAsArrayBuffer(file);
        });
    }
};
BrowserFileUpload = BrowserFileUpload_1 = __decorate([
    __param(0, IProgressService),
    __param(1, IDialogService),
    __param(2, IExplorerService),
    __param(3, IEditorService),
    __param(4, IFileService)
], BrowserFileUpload);
export { BrowserFileUpload };
//#endregion
//#region External File Import (drag and drop)
let ExternalFileImport = class ExternalFileImport {
    constructor(fileService, hostService, contextService, configurationService, dialogService, workspaceEditingService, explorerService, editorService, progressService, notificationService, instantiationService) {
        this.fileService = fileService;
        this.hostService = hostService;
        this.contextService = contextService;
        this.configurationService = configurationService;
        this.dialogService = dialogService;
        this.workspaceEditingService = workspaceEditingService;
        this.explorerService = explorerService;
        this.editorService = editorService;
        this.progressService = progressService;
        this.notificationService = notificationService;
        this.instantiationService = instantiationService;
    }
    async import(target, source, targetWindow) {
        const cts = new CancellationTokenSource();
        // Indicate progress globally
        const importPromise = this.progressService.withProgress({
            location: 10 /* ProgressLocation.Window */,
            delay: 800,
            cancellable: true,
            title: localize('copyingFiles', "Copying...")
        }, async () => await this.doImport(target, source, targetWindow, cts.token), () => cts.dispose(true));
        // Also indicate progress in the files view
        this.progressService.withProgress({ location: VIEW_ID, delay: 500 }, () => importPromise);
        return importPromise;
    }
    async doImport(target, source, targetWindow, token) {
        // Activate all providers for the resources dropped
        const candidateFiles = coalesce((await this.instantiationService.invokeFunction(accessor => extractEditorsAndFilesDropData(accessor, source))).map(editor => editor.resource));
        await Promise.all(candidateFiles.map(resource => this.fileService.activateProvider(resource.scheme)));
        // Check for dropped external files to be folders
        const files = coalesce(candidateFiles.filter(resource => this.fileService.hasProvider(resource)));
        const resolvedFiles = await this.fileService.resolveAll(files.map(file => ({ resource: file })));
        if (token.isCancellationRequested) {
            return;
        }
        // Pass focus to window
        this.hostService.focus(targetWindow);
        // Handle folders by adding to workspace if we are in workspace context and if dropped on top
        const folders = resolvedFiles.filter(resolvedFile => resolvedFile.success && resolvedFile.stat?.isDirectory).map(resolvedFile => ({ uri: resolvedFile.stat.resource }));
        if (folders.length > 0 && target.isRoot) {
            let ImportChoice;
            (function (ImportChoice) {
                ImportChoice[ImportChoice["Copy"] = 1] = "Copy";
                ImportChoice[ImportChoice["Add"] = 2] = "Add";
            })(ImportChoice || (ImportChoice = {}));
            const buttons = [
                {
                    label: folders.length > 1 ?
                        localize('copyFolders', "&&Copy Folders") :
                        localize('copyFolder', "&&Copy Folder"),
                    run: () => ImportChoice.Copy
                }
            ];
            let message;
            // We only allow to add a folder to the workspace if there is already a workspace folder with that scheme
            const workspaceFolderSchemas = this.contextService.getWorkspace().folders.map(folder => folder.uri.scheme);
            if (folders.some(folder => workspaceFolderSchemas.indexOf(folder.uri.scheme) >= 0)) {
                buttons.unshift({
                    label: folders.length > 1 ?
                        localize('addFolders', "&&Add Folders to Workspace") :
                        localize('addFolder', "&&Add Folder to Workspace"),
                    run: () => ImportChoice.Add
                });
                message = folders.length > 1 ?
                    localize('dropFolders', "Do you want to copy the folders or add the folders to the workspace?") :
                    localize('dropFolder', "Do you want to copy '{0}' or add '{0}' as a folder to the workspace?", basename(folders[0].uri));
            }
            else {
                message = folders.length > 1 ?
                    localize('copyfolders', "Are you sure to want to copy folders?") :
                    localize('copyfolder', "Are you sure to want to copy '{0}'?", basename(folders[0].uri));
            }
            const { result } = await this.dialogService.prompt({
                type: Severity.Info,
                message,
                buttons,
                cancelButton: true
            });
            // Add folders
            if (result === ImportChoice.Add) {
                return this.workspaceEditingService.addFolders(folders);
            }
            // Copy resources
            if (result === ImportChoice.Copy) {
                return this.importResources(target, files, token);
            }
        }
        // Handle dropped files (only support FileStat as target)
        else if (target instanceof ExplorerItem) {
            return this.importResources(target, files, token);
        }
    }
    async importResources(target, resources, token) {
        if (resources && resources.length > 0) {
            // Resolve target to check for name collisions and ask user
            const targetStat = await this.fileService.resolve(target.resource);
            if (token.isCancellationRequested) {
                return;
            }
            // Check for name collisions
            const targetNames = new Set();
            const caseSensitive = this.fileService.hasCapability(target.resource, 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */);
            if (targetStat.children) {
                targetStat.children.forEach(child => {
                    targetNames.add(caseSensitive ? child.name : child.name.toLowerCase());
                });
            }
            let inaccessibleFileCount = 0;
            const resourcesFiltered = coalesce((await Promises.settled(resources.map(async (resource) => {
                const fileDoesNotExist = !(await this.fileService.exists(resource));
                if (fileDoesNotExist) {
                    inaccessibleFileCount++;
                    return undefined;
                }
                if (targetNames.has(caseSensitive ? basename(resource) : basename(resource).toLowerCase())) {
                    const confirmationResult = await this.dialogService.confirm(getFileOverwriteConfirm(basename(resource)));
                    if (!confirmationResult.confirmed) {
                        return undefined;
                    }
                }
                return resource;
            }))));
            if (inaccessibleFileCount > 0) {
                this.notificationService.error(inaccessibleFileCount > 1 ? localize('filesInaccessible', "Some or all of the dropped files could not be accessed for import.") : localize('fileInaccessible', "The dropped file could not be accessed for import."));
            }
            // Copy resources through bulk edit API
            const resourceFileEdits = resourcesFiltered.map(resource => {
                const sourceFileName = basename(resource);
                const targetFile = joinPath(target.resource, sourceFileName);
                return new ResourceFileEdit(resource, targetFile, { overwrite: true, copy: true });
            });
            const undoLevel = this.configurationService.getValue().explorer.confirmUndo;
            await this.explorerService.applyBulkEdit(resourceFileEdits, {
                undoLabel: resourcesFiltered.length === 1 ?
                    localize({ comment: ['substitution will be the name of the file that was imported'], key: 'importFile' }, "Import {0}", basename(resourcesFiltered[0])) :
                    localize({ comment: ['substitution will be the number of files that were imported'], key: 'importnFile' }, "Import {0} resources", resourcesFiltered.length),
                progressLabel: resourcesFiltered.length === 1 ?
                    localize({ comment: ['substitution will be the name of the file that was copied'], key: 'copyingFile' }, "Copying {0}", basename(resourcesFiltered[0])) :
                    localize({ comment: ['substitution will be the number of files that were copied'], key: 'copyingnFile' }, "Copying {0} resources", resourcesFiltered.length),
                progressLocation: 10 /* ProgressLocation.Window */,
                confirmBeforeUndo: undoLevel === "verbose" /* UndoConfirmLevel.Verbose */ || undoLevel === "default" /* UndoConfirmLevel.Default */,
            });
            // if we only add one file, just open it directly
            const autoOpen = this.configurationService.getValue().explorer.autoOpenDroppedFile;
            if (autoOpen && resourceFileEdits.length === 1) {
                const item = this.explorerService.findClosest(resourceFileEdits[0].newResource);
                if (item && !item.isDirectory) {
                    this.editorService.openEditor({ resource: item.resource, options: { pinned: true } });
                }
            }
        }
    }
};
ExternalFileImport = __decorate([
    __param(0, IFileService),
    __param(1, IHostService),
    __param(2, IWorkspaceContextService),
    __param(3, IConfigurationService),
    __param(4, IDialogService),
    __param(5, IWorkspaceEditingService),
    __param(6, IExplorerService),
    __param(7, IEditorService),
    __param(8, IProgressService),
    __param(9, INotificationService),
    __param(10, IInstantiationService)
], ExternalFileImport);
export { ExternalFileImport };
let FileDownload = class FileDownload {
    static { FileDownload_1 = this; }
    static { this.LAST_USED_DOWNLOAD_PATH_STORAGE_KEY = 'workbench.explorer.downloadPath'; }
    constructor(fileService, explorerService, progressService, logService, fileDialogService, storageService) {
        this.fileService = fileService;
        this.explorerService = explorerService;
        this.progressService = progressService;
        this.logService = logService;
        this.fileDialogService = fileDialogService;
        this.storageService = storageService;
    }
    download(source) {
        const cts = new CancellationTokenSource();
        // Indicate progress globally
        const downloadPromise = this.progressService.withProgress({
            location: 10 /* ProgressLocation.Window */,
            delay: 800,
            cancellable: isWeb,
            title: localize('downloadingFiles', "Downloading")
        }, async (progress) => this.doDownload(source, progress, cts), () => cts.dispose(true));
        // Also indicate progress in the files view
        this.progressService.withProgress({ location: VIEW_ID, delay: 500 }, () => downloadPromise);
        return downloadPromise;
    }
    async doDownload(sources, progress, cts) {
        for (const source of sources) {
            if (cts.token.isCancellationRequested) {
                return;
            }
            // Web: use DOM APIs to download files with optional support
            // for folders and large files
            if (isWeb) {
                await this.doDownloadBrowser(source.resource, progress, cts);
            }
            // Native: use working copy file service to get at the contents
            else {
                await this.doDownloadNative(source, progress, cts);
            }
        }
    }
    async doDownloadBrowser(resource, progress, cts) {
        const stat = await this.fileService.resolve(resource, { resolveMetadata: true });
        if (cts.token.isCancellationRequested) {
            return;
        }
        const maxBlobDownloadSize = 32 * ByteSize.MB; // avoid to download via blob-trick >32MB to avoid memory pressure
        const preferFileSystemAccessWebApis = stat.isDirectory || stat.size > maxBlobDownloadSize;
        // Folder: use FS APIs to download files and folders if available and preferred
        const activeWindow = getActiveWindow();
        if (preferFileSystemAccessWebApis && WebFileSystemAccess.supported(activeWindow)) {
            try {
                const parentFolder = await activeWindow.showDirectoryPicker();
                const operation = {
                    startTime: Date.now(),
                    progressScheduler: new RunOnceWorker(steps => { progress.report(steps[steps.length - 1]); }, 1000),
                    filesTotal: stat.isDirectory ? 0 : 1, // folders increment filesTotal within downloadFolder method
                    filesDownloaded: 0,
                    totalBytesDownloaded: 0,
                    fileBytesDownloaded: 0
                };
                if (stat.isDirectory) {
                    const targetFolder = await parentFolder.getDirectoryHandle(stat.name, { create: true });
                    await this.downloadFolderBrowser(stat, targetFolder, operation, cts.token);
                }
                else {
                    await this.downloadFileBrowser(parentFolder, stat, operation, cts.token);
                }
                operation.progressScheduler.dispose();
            }
            catch (error) {
                this.logService.warn(error);
                cts.cancel(); // `showDirectoryPicker` will throw an error when the user cancels
            }
        }
        // File: use traditional download to circumvent browser limitations
        else if (stat.isFile) {
            let bufferOrUri;
            try {
                bufferOrUri = (await this.fileService.readFile(stat.resource, { limits: { size: maxBlobDownloadSize } }, cts.token)).value.buffer;
            }
            catch (error) {
                bufferOrUri = FileAccess.uriToBrowserUri(stat.resource);
            }
            if (!cts.token.isCancellationRequested) {
                triggerDownload(bufferOrUri, stat.name);
            }
        }
    }
    async downloadFileBufferedBrowser(resource, target, operation, token) {
        const contents = await this.fileService.readFileStream(resource, undefined, token);
        if (token.isCancellationRequested) {
            target.close();
            return;
        }
        return new Promise((resolve, reject) => {
            const sourceStream = contents.value;
            const disposables = new DisposableStore();
            disposables.add(toDisposable(() => target.close()));
            disposables.add(createSingleCallFunction(token.onCancellationRequested)(() => {
                disposables.dispose();
                reject(canceled());
            }));
            listenStream(sourceStream, {
                onData: data => {
                    target.write(data.buffer);
                    this.reportProgress(contents.name, contents.size, data.byteLength, operation);
                },
                onError: error => {
                    disposables.dispose();
                    reject(error);
                },
                onEnd: () => {
                    disposables.dispose();
                    resolve();
                }
            }, token);
        });
    }
    async downloadFileUnbufferedBrowser(resource, target, operation, token) {
        const contents = await this.fileService.readFile(resource, undefined, token);
        if (!token.isCancellationRequested) {
            target.write(contents.value.buffer);
            this.reportProgress(contents.name, contents.size, contents.value.byteLength, operation);
        }
        target.close();
    }
    async downloadFileBrowser(targetFolder, file, operation, token) {
        // Report progress
        operation.filesDownloaded++;
        operation.fileBytesDownloaded = 0; // reset for this file
        this.reportProgress(file.name, 0, 0, operation);
        // Start to download
        const targetFile = await targetFolder.getFileHandle(file.name, { create: true });
        const targetFileWriter = await targetFile.createWritable();
        // For large files, write buffered using streams
        if (file.size > ByteSize.MB) {
            return this.downloadFileBufferedBrowser(file.resource, targetFileWriter, operation, token);
        }
        // For small files prefer to write unbuffered to reduce overhead
        return this.downloadFileUnbufferedBrowser(file.resource, targetFileWriter, operation, token);
    }
    async downloadFolderBrowser(folder, targetFolder, operation, token) {
        if (folder.children) {
            operation.filesTotal += (folder.children.map(child => child.isFile)).length;
            for (const child of folder.children) {
                if (token.isCancellationRequested) {
                    return;
                }
                if (child.isFile) {
                    await this.downloadFileBrowser(targetFolder, child, operation, token);
                }
                else {
                    const childFolder = await targetFolder.getDirectoryHandle(child.name, { create: true });
                    const resolvedChildFolder = await this.fileService.resolve(child.resource, { resolveMetadata: true });
                    await this.downloadFolderBrowser(resolvedChildFolder, childFolder, operation, token);
                }
            }
        }
    }
    reportProgress(name, fileSize, bytesDownloaded, operation) {
        operation.fileBytesDownloaded += bytesDownloaded;
        operation.totalBytesDownloaded += bytesDownloaded;
        const bytesDownloadedPerSecond = operation.totalBytesDownloaded / ((Date.now() - operation.startTime) / 1000);
        // Small file
        let message;
        if (fileSize < ByteSize.MB) {
            if (operation.filesTotal === 1) {
                message = name;
            }
            else {
                message = localize('downloadProgressSmallMany', "{0} of {1} files ({2}/s)", operation.filesDownloaded, operation.filesTotal, ByteSize.formatSize(bytesDownloadedPerSecond));
            }
        }
        // Large file
        else {
            message = localize('downloadProgressLarge', "{0} ({1} of {2}, {3}/s)", name, ByteSize.formatSize(operation.fileBytesDownloaded), ByteSize.formatSize(fileSize), ByteSize.formatSize(bytesDownloadedPerSecond));
        }
        // Report progress but limit to update only once per second
        operation.progressScheduler.work({ message });
    }
    async doDownloadNative(explorerItem, progress, cts) {
        progress.report({ message: explorerItem.name });
        let defaultUri;
        const lastUsedDownloadPath = this.storageService.get(FileDownload_1.LAST_USED_DOWNLOAD_PATH_STORAGE_KEY, -1 /* StorageScope.APPLICATION */);
        if (lastUsedDownloadPath) {
            defaultUri = joinPath(URI.file(lastUsedDownloadPath), explorerItem.name);
        }
        else {
            defaultUri = joinPath(explorerItem.isDirectory ?
                await this.fileDialogService.defaultFolderPath(Schemas.file) :
                await this.fileDialogService.defaultFilePath(Schemas.file), explorerItem.name);
        }
        const destination = await this.fileDialogService.showSaveDialog({
            availableFileSystems: [Schemas.file],
            saveLabel: localize('downloadButton', "Download"),
            title: localize('chooseWhereToDownload', "Choose Where to Download"),
            defaultUri
        });
        if (destination) {
            // Remember as last used download folder
            this.storageService.store(FileDownload_1.LAST_USED_DOWNLOAD_PATH_STORAGE_KEY, dirname(destination).fsPath, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
            // Perform download
            await this.explorerService.applyBulkEdit([new ResourceFileEdit(explorerItem.resource, destination, { overwrite: true, copy: true })], {
                undoLabel: localize('downloadBulkEdit', "Download {0}", explorerItem.name),
                progressLabel: localize('downloadingBulkEdit', "Downloading {0}", explorerItem.name),
                progressLocation: 10 /* ProgressLocation.Window */
            });
        }
        else {
            cts.cancel(); // User canceled a download. In case there were multiple files selected we should cancel the remainder of the prompts #86100
        }
    }
};
FileDownload = FileDownload_1 = __decorate([
    __param(0, IFileService),
    __param(1, IExplorerService),
    __param(2, IProgressService),
    __param(3, ILogService),
    __param(4, IFileDialogService),
    __param(5, IStorageService)
], FileDownload);
export { FileDownload };
//#endregion
//#region Helpers
export function getFileOverwriteConfirm(name) {
    return {
        message: localize('confirmOverwrite', "A file or folder with the name '{0}' already exists in the destination folder. Do you want to replace it?", name),
        detail: localize('irreversible', "This action is irreversible!"),
        primaryButton: localize({ key: 'replaceButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Replace"),
        type: 'warning'
    };
}
export function getMultipleFilesOverwriteConfirm(files) {
    if (files.length > 1) {
        return {
            message: localize('confirmManyOverwrites', "The following {0} files and/or folders already exist in the destination folder. Do you want to replace them?", files.length),
            detail: getFileNamesMessage(files) + '\n' + localize('irreversible', "This action is irreversible!"),
            primaryButton: localize({ key: 'replaceButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Replace"),
            type: 'warning'
        };
    }
    return getFileOverwriteConfirm(basename(files[0]));
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZUltcG9ydEV4cG9ydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2ZpbGVJbXBvcnRFeHBvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLG1CQUFtQixFQUFpQixjQUFjLEVBQUUsa0JBQWtCLEVBQWlCLE1BQU0sZ0RBQWdELENBQUM7QUFDdkosT0FBTyxFQUFFLFFBQVEsRUFBa0MsWUFBWSxFQUF5QixNQUFNLDRDQUE0QyxDQUFDO0FBQzNJLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxRQUFRLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUMxRyxPQUFPLEVBQWEsZ0JBQWdCLEVBQW1DLE1BQU0sa0RBQWtELENBQUM7QUFDaEksT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzlDLE9BQU8sRUFBeUMsT0FBTyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDcEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RixPQUFPLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsWUFBWSxFQUFF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