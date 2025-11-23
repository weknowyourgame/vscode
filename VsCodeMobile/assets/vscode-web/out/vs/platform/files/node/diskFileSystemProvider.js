/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { promises } from 'fs';
import { Barrier, retry } from '../../../base/common/async.js';
import { ResourceMap } from '../../../base/common/map.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { Event } from '../../../base/common/event.js';
import { isEqual } from '../../../base/common/extpath.js';
import { DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { basename, dirname, join } from '../../../base/common/path.js';
import { isLinux, isWindows } from '../../../base/common/platform.js';
import { extUriBiasedIgnorePathCase, joinPath, basename as resourcesBasename, dirname as resourcesDirname } from '../../../base/common/resources.js';
import { newWriteableStream } from '../../../base/common/stream.js';
import { Promises, RimRafMode, SymlinkSupport } from '../../../base/node/pfs.js';
import { localize } from '../../../nls.js';
import { createFileSystemProviderError, FileSystemProviderError, FileSystemProviderErrorCode, FileType, isFileOpenForWriteOptions, FilePermission } from '../common/files.js';
import { readFileIntoStream } from '../common/io.js';
import { AbstractDiskFileSystemProvider } from '../common/diskFileSystemProvider.js';
import { UniversalWatcherClient } from './watcher/watcherClient.js';
import { NodeJSWatcherClient } from './watcher/nodejs/nodejsClient.js';
export class DiskFileSystemProvider extends AbstractDiskFileSystemProvider {
    constructor() {
        super(...arguments);
        //#region File Capabilities
        this.onDidChangeCapabilities = Event.None;
        //#endregion
        //#region File Reading/Writing
        this.resourceLocks = new ResourceMap(resource => extUriBiasedIgnorePathCase.getComparisonKey(resource));
        this.mapHandleToPos = new Map();
        this.mapHandleToLock = new Map();
        this.writeHandles = new Map();
        //#endregion
    }
    static { this.TRACE_LOG_RESOURCE_LOCKS = false; } // not enabled by default because very spammy
    get capabilities() {
        if (!this._capabilities) {
            this._capabilities =
                2 /* FileSystemProviderCapabilities.FileReadWrite */ |
                    4 /* FileSystemProviderCapabilities.FileOpenReadWriteClose */ |
                    16 /* FileSystemProviderCapabilities.FileReadStream */ |
                    8 /* FileSystemProviderCapabilities.FileFolderCopy */ |
                    8192 /* FileSystemProviderCapabilities.FileWriteUnlock */ |
                    16384 /* FileSystemProviderCapabilities.FileAtomicRead */ |
                    32768 /* FileSystemProviderCapabilities.FileAtomicWrite */ |
                    65536 /* FileSystemProviderCapabilities.FileAtomicDelete */ |
                    131072 /* FileSystemProviderCapabilities.FileClone */ |
                    262144 /* FileSystemProviderCapabilities.FileRealpath */;
            if (isLinux) {
                this._capabilities |= 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */;
            }
        }
        return this._capabilities;
    }
    //#endregion
    //#region File Metadata Resolving
    async stat(resource) {
        try {
            const { stat, symbolicLink } = await SymlinkSupport.stat(this.toFilePath(resource)); // cannot use fs.stat() here to support links properly
            return {
                type: this.toType(stat, symbolicLink),
                ctime: stat.birthtime.getTime(), // intentionally not using ctime here, we want the creation time
                mtime: stat.mtime.getTime(),
                size: stat.size,
                permissions: (stat.mode & 0o200) === 0 ? FilePermission.Locked : undefined
            };
        }
        catch (error) {
            throw this.toFileSystemProviderError(error);
        }
    }
    async statIgnoreError(resource) {
        try {
            return await this.stat(resource);
        }
        catch (error) {
            return undefined;
        }
    }
    async realpath(resource) {
        const filePath = this.toFilePath(resource);
        return Promises.realpath(filePath);
    }
    async readdir(resource) {
        try {
            const children = await Promises.readdir(this.toFilePath(resource), { withFileTypes: true });
            const result = [];
            await Promise.all(children.map(async (child) => {
                try {
                    let type;
                    if (child.isSymbolicLink()) {
                        type = (await this.stat(joinPath(resource, child.name))).type; // always resolve target the link points to if any
                    }
                    else {
                        type = this.toType(child);
                    }
                    result.push([child.name, type]);
                }
                catch (error) {
                    this.logService.trace(error); // ignore errors for individual entries that can arise from permission denied
                }
            }));
            return result;
        }
        catch (error) {
            throw this.toFileSystemProviderError(error);
        }
    }
    toType(entry, symbolicLink) {
        // Signal file type by checking for file / directory, except:
        // - symbolic links pointing to nonexistent files are FileType.Unknown
        // - files that are neither file nor directory are FileType.Unknown
        let type;
        if (symbolicLink?.dangling) {
            type = FileType.Unknown;
        }
        else if (entry.isFile()) {
            type = FileType.File;
        }
        else if (entry.isDirectory()) {
            type = FileType.Directory;
        }
        else {
            type = FileType.Unknown;
        }
        // Always signal symbolic link as file type additionally
        if (symbolicLink) {
            type |= FileType.SymbolicLink;
        }
        return type;
    }
    async createResourceLock(resource) {
        const filePath = this.toFilePath(resource);
        this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - request to acquire resource lock (${filePath})`);
        // Await pending locks for resource. It is possible for a new lock being
        // added right after opening, so we have to loop over locks until no lock
        // remains.
        let existingLock = undefined;
        while (existingLock = this.resourceLocks.get(resource)) {
            this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - waiting for resource lock to be released (${filePath})`);
            await existingLock.wait();
        }
        // Store new
        const newLock = new Barrier();
        this.resourceLocks.set(resource, newLock);
        this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - new resource lock created (${filePath})`);
        return toDisposable(() => {
            this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - resource lock dispose() (${filePath})`);
            // Delete lock if it is still ours
            if (this.resourceLocks.get(resource) === newLock) {
                this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - resource lock removed from resource-lock map (${filePath})`);
                this.resourceLocks.delete(resource);
            }
            // Open lock
            this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - resource lock barrier open() (${filePath})`);
            newLock.open();
        });
    }
    async readFile(resource, options) {
        let lock = undefined;
        try {
            if (options?.atomic) {
                this.traceLock(`[Disk FileSystemProvider]: atomic read operation started (${this.toFilePath(resource)})`);
                // When the read should be atomic, make sure
                // to await any pending locks for the resource
                // and lock for the duration of the read.
                lock = await this.createResourceLock(resource);
            }
            const filePath = this.toFilePath(resource);
            return await promises.readFile(filePath);
        }
        catch (error) {
            throw this.toFileSystemProviderError(error);
        }
        finally {
            lock?.dispose();
        }
    }
    traceLock(msg) {
        if (DiskFileSystemProvider.TRACE_LOG_RESOURCE_LOCKS) {
            this.logService.trace(msg);
        }
    }
    readFileStream(resource, opts, token) {
        const stream = newWriteableStream(data => VSBuffer.concat(data.map(data => VSBuffer.wrap(data))).buffer);
        readFileIntoStream(this, resource, stream, data => data.buffer, {
            ...opts,
            bufferSize: 256 * 1024 // read into chunks of 256kb each to reduce IPC overhead
        }, token);
        return stream;
    }
    async writeFile(resource, content, opts) {
        if (opts?.atomic !== false && opts?.atomic?.postfix && await this.canWriteFileAtomic(resource)) {
            return this.doWriteFileAtomic(resource, joinPath(resourcesDirname(resource), `${resourcesBasename(resource)}${opts.atomic.postfix}`), content, opts);
        }
        else {
            return this.doWriteFile(resource, content, opts);
        }
    }
    async canWriteFileAtomic(resource) {
        try {
            const filePath = this.toFilePath(resource);
            const { symbolicLink } = await SymlinkSupport.stat(filePath);
            if (symbolicLink) {
                // atomic writes are unsupported for symbolic links because
                // we need to ensure that the `rename` operation is atomic
                // and that only works if the link is on the same disk.
                // Since we do not know where the symbolic link points to
                // we refuse to write atomically.
                return false;
            }
        }
        catch (error) {
            // ignore stat errors here and just proceed trying to write
        }
        return true; // atomic writing supported
    }
    async doWriteFileAtomic(resource, tempResource, content, opts) {
        // Ensure to create locks for all resources involved
        // since atomic write involves mutiple disk operations
        // and resources.
        const locks = new DisposableStore();
        try {
            locks.add(await this.createResourceLock(resource));
            locks.add(await this.createResourceLock(tempResource));
            // Write to temp resource first
            await this.doWriteFile(tempResource, content, opts, true /* disable write lock */);
            try {
                // Rename over existing to ensure atomic replace
                await this.rename(tempResource, resource, { overwrite: true });
            }
            catch (error) {
                // Cleanup in case of rename error
                try {
                    await this.delete(tempResource, { recursive: false, useTrash: false, atomic: false });
                }
                catch (error) {
                    // ignore - we want the outer error to bubble up
                }
                throw error;
            }
        }
        finally {
            locks.dispose();
        }
    }
    async doWriteFile(resource, content, opts, disableWriteLock) {
        let handle = undefined;
        try {
            const filePath = this.toFilePath(resource);
            // Validate target unless { create: true, overwrite: true }
            if (!opts.create || !opts.overwrite) {
                const fileExists = await Promises.exists(filePath);
                if (fileExists) {
                    if (!opts.overwrite) {
                        throw createFileSystemProviderError(localize('fileExists', "File already exists"), FileSystemProviderErrorCode.FileExists);
                    }
                }
                else {
                    if (!opts.create) {
                        throw createFileSystemProviderError(localize('fileNotExists', "File does not exist"), FileSystemProviderErrorCode.FileNotFound);
                    }
                }
            }
            // Open
            handle = await this.open(resource, { create: true, unlock: opts.unlock }, disableWriteLock);
            // Write content at once
            await this.write(handle, 0, content, 0, content.byteLength);
        }
        catch (error) {
            throw await this.toFileSystemProviderWriteError(resource, error);
        }
        finally {
            if (typeof handle === 'number') {
                await this.close(handle);
            }
        }
    }
    static { this.canFlush = true; }
    static configureFlushOnWrite(enabled) {
        DiskFileSystemProvider.canFlush = enabled;
    }
    async open(resource, opts, disableWriteLock) {
        const filePath = this.toFilePath(resource);
        // Writes: guard multiple writes to the same resource
        // behind a single lock to prevent races when writing
        // from multiple places at the same time to the same file
        let lock = undefined;
        if (isFileOpenForWriteOptions(opts) && !disableWriteLock) {
            lock = await this.createResourceLock(resource);
        }
        let fd = undefined;
        try {
            // Determine whether to unlock the file (write only)
            if (isFileOpenForWriteOptions(opts) && opts.unlock) {
                try {
                    const { stat } = await SymlinkSupport.stat(filePath);
                    if (!(stat.mode & 0o200 /* File mode indicating writable by owner */)) {
                        await promises.chmod(filePath, stat.mode | 0o200);
                    }
                }
                catch (error) {
                    if (error.code !== 'ENOENT') {
                        this.logService.trace(error); // log errors but do not give up writing
                    }
                }
            }
            // Windows gets special treatment (write only)
            if (isWindows && isFileOpenForWriteOptions(opts)) {
                try {
                    // We try to use 'r+' for opening (which will fail if the file does not exist)
                    // to prevent issues when saving hidden files or preserving alternate data
                    // streams.
                    // Related issues:
                    // - https://github.com/microsoft/vscode/issues/931
                    // - https://github.com/microsoft/vscode/issues/6363
                    fd = await Promises.open(filePath, 'r+');
                    // The flag 'r+' will not truncate the file, so we have to do this manually
                    await Promises.ftruncate(fd, 0);
                }
                catch (error) {
                    if (error.code !== 'ENOENT') {
                        this.logService.trace(error); // log errors but do not give up writing
                    }
                    // Make sure to close the file handle if we have one
                    if (typeof fd === 'number') {
                        try {
                            await Promises.close(fd);
                        }
                        catch (error) {
                            this.logService.trace(error); // log errors but do not give up writing
                        }
                        // Reset `fd` to be able to try again with 'w'
                        fd = undefined;
                    }
                }
            }
            if (typeof fd !== 'number') {
                fd = await Promises.open(filePath, isFileOpenForWriteOptions(opts) ?
                    // We take `opts.create` as a hint that the file is opened for writing
                    // as such we use 'w' to truncate an existing or create the
                    // file otherwise. we do not allow reading.
                    'w' :
                    // Otherwise we assume the file is opened for reading
                    // as such we use 'r' to neither truncate, nor create
                    // the file.
                    'r');
            }
        }
        catch (error) {
            // Release lock because we have no valid handle
            // if we did open a lock during this operation
            lock?.dispose();
            // Rethrow as file system provider error
            if (isFileOpenForWriteOptions(opts)) {
                throw await this.toFileSystemProviderWriteError(resource, error);
            }
            else {
                throw this.toFileSystemProviderError(error);
            }
        }
        // Remember this handle to track file position of the handle
        // we init the position to 0 since the file descriptor was
        // just created and the position was not moved so far (see
        // also http://man7.org/linux/man-pages/man2/open.2.html -
        // "The file offset is set to the beginning of the file.")
        this.mapHandleToPos.set(fd, 0);
        // remember that this handle was used for writing
        if (isFileOpenForWriteOptions(opts)) {
            this.writeHandles.set(fd, resource);
        }
        if (lock) {
            const previousLock = this.mapHandleToLock.get(fd);
            // Remember that this handle has an associated lock
            this.traceLock(`[Disk FileSystemProvider]: open() - storing lock for handle ${fd} (${filePath})`);
            this.mapHandleToLock.set(fd, lock);
            // There is a slight chance that a resource lock for a
            // handle was not yet disposed when we acquire a new
            // lock, so we must ensure to dispose the previous lock
            // before storing a new one for the same handle, other
            // wise we end up in a deadlock situation
            // https://github.com/microsoft/vscode/issues/142462
            if (previousLock) {
                this.traceLock(`[Disk FileSystemProvider]: open() - disposing a previous lock that was still stored on same handle ${fd} (${filePath})`);
                previousLock.dispose();
            }
        }
        return fd;
    }
    async close(fd) {
        // It is very important that we keep any associated lock
        // for the file handle before attempting to call `fs.close(fd)`
        // because of a possible race condition: as soon as a file
        // handle is released, the OS may assign the same handle to
        // the next `fs.open` call and as such it is possible that our
        // lock is getting overwritten
        const lockForHandle = this.mapHandleToLock.get(fd);
        try {
            // Remove this handle from map of positions
            this.mapHandleToPos.delete(fd);
            // If a handle is closed that was used for writing, ensure
            // to flush the contents to disk if possible.
            if (this.writeHandles.delete(fd) && DiskFileSystemProvider.canFlush) {
                try {
                    await Promises.fdatasync(fd); // https://github.com/microsoft/vscode/issues/9589
                }
                catch (error) {
                    // In some exotic setups it is well possible that node fails to sync
                    // In that case we disable flushing and log the error to our logger
                    DiskFileSystemProvider.configureFlushOnWrite(false);
                    this.logService.error(error);
                }
            }
            return await Promises.close(fd);
        }
        catch (error) {
            throw this.toFileSystemProviderError(error);
        }
        finally {
            if (lockForHandle) {
                if (this.mapHandleToLock.get(fd) === lockForHandle) {
                    this.traceLock(`[Disk FileSystemProvider]: close() - resource lock removed from handle-lock map ${fd}`);
                    this.mapHandleToLock.delete(fd); // only delete from map if this is still our lock!
                }
                this.traceLock(`[Disk FileSystemProvider]: close() - disposing lock for handle ${fd}`);
                lockForHandle.dispose();
            }
        }
    }
    async read(fd, pos, data, offset, length) {
        const normalizedPos = this.normalizePos(fd, pos);
        let bytesRead = null;
        try {
            bytesRead = (await Promises.read(fd, data, offset, length, normalizedPos)).bytesRead;
        }
        catch (error) {
            throw this.toFileSystemProviderError(error);
        }
        finally {
            this.updatePos(fd, normalizedPos, bytesRead);
        }
        return bytesRead;
    }
    normalizePos(fd, pos) {
        // When calling fs.read/write we try to avoid passing in the "pos" argument and
        // rather prefer to pass in "null" because this avoids an extra seek(pos)
        // call that in some cases can even fail (e.g. when opening a file over FTP -
        // see https://github.com/microsoft/vscode/issues/73884).
        //
        // as such, we compare the passed in position argument with our last known
        // position for the file descriptor and use "null" if they match.
        if (pos === this.mapHandleToPos.get(fd)) {
            return null;
        }
        return pos;
    }
    updatePos(fd, pos, bytesLength) {
        const lastKnownPos = this.mapHandleToPos.get(fd);
        if (typeof lastKnownPos === 'number') {
            // pos !== null signals that previously a position was used that is
            // not null. node.js documentation explains, that in this case
            // the internal file pointer is not moving and as such we do not move
            // our position pointer.
            //
            // Docs: "If position is null, data will be read from the current file position,
            // and the file position will be updated. If position is an integer, the file position
            // will remain unchanged."
            if (typeof pos === 'number') {
                // do not modify the position
            }
            // bytesLength = number is a signal that the read/write operation was
            // successful and as such we need to advance the position in the Map
            //
            // Docs (http://man7.org/linux/man-pages/man2/read.2.html):
            // "On files that support seeking, the read operation commences at the
            // file offset, and the file offset is incremented by the number of
            // bytes read."
            //
            // Docs (http://man7.org/linux/man-pages/man2/write.2.html):
            // "For a seekable file (i.e., one to which lseek(2) may be applied, for
            // example, a regular file) writing takes place at the file offset, and
            // the file offset is incremented by the number of bytes actually
            // written."
            else if (typeof bytesLength === 'number') {
                this.mapHandleToPos.set(fd, lastKnownPos + bytesLength);
            }
            // bytesLength = null signals an error in the read/write operation
            // and as such we drop the handle from the Map because the position
            // is unspecificed at this point.
            else {
                this.mapHandleToPos.delete(fd);
            }
        }
    }
    async write(fd, pos, data, offset, length) {
        // We know at this point that the file to write to is truncated and thus empty
        // if the write now fails, the file remains empty. as such we really try hard
        // to ensure the write succeeds by retrying up to three times.
        return retry(() => this.doWrite(fd, pos, data, offset, length), 100 /* ms delay */, 3 /* retries */);
    }
    async doWrite(fd, pos, data, offset, length) {
        const normalizedPos = this.normalizePos(fd, pos);
        let bytesWritten = null;
        try {
            bytesWritten = (await Promises.write(fd, data, offset, length, normalizedPos)).bytesWritten;
        }
        catch (error) {
            throw await this.toFileSystemProviderWriteError(this.writeHandles.get(fd), error);
        }
        finally {
            this.updatePos(fd, normalizedPos, bytesWritten);
        }
        return bytesWritten;
    }
    //#endregion
    //#region Move/Copy/Delete/Create Folder
    async mkdir(resource) {
        try {
            await promises.mkdir(this.toFilePath(resource));
        }
        catch (error) {
            throw this.toFileSystemProviderError(error);
        }
    }
    async delete(resource, opts) {
        try {
            const filePath = this.toFilePath(resource);
            if (opts.recursive) {
                let rmMoveToPath = undefined;
                if (opts?.atomic !== false && opts.atomic.postfix) {
                    rmMoveToPath = join(dirname(filePath), `${basename(filePath)}${opts.atomic.postfix}`);
                }
                await Promises.rm(filePath, RimRafMode.MOVE, rmMoveToPath);
            }
            else {
                try {
                    await promises.unlink(filePath);
                }
                catch (unlinkError) {
                    // `fs.unlink` will throw when used on directories
                    // we try to detect this error and then see if the
                    // provided resource is actually a directory. in that
                    // case we use `fs.rmdir` to delete the directory.
                    if (unlinkError.code === 'EPERM' || unlinkError.code === 'EISDIR') {
                        let isDirectory = false;
                        try {
                            const { stat, symbolicLink } = await SymlinkSupport.stat(filePath);
                            isDirectory = stat.isDirectory() && !symbolicLink;
                        }
                        catch (statError) {
                            // ignore
                        }
                        if (isDirectory) {
                            await promises.rmdir(filePath);
                        }
                        else {
                            throw unlinkError;
                        }
                    }
                    else {
                        throw unlinkError;
                    }
                }
            }
        }
        catch (error) {
            throw this.toFileSystemProviderError(error);
        }
    }
    async rename(from, to, opts) {
        const fromFilePath = this.toFilePath(from);
        const toFilePath = this.toFilePath(to);
        if (fromFilePath === toFilePath) {
            return; // simulate node.js behaviour here and do a no-op if paths match
        }
        try {
            // Validate the move operation can perform
            await this.validateMoveCopy(from, to, 'move', opts.overwrite);
            // Rename
            await Promises.rename(fromFilePath, toFilePath);
        }
        catch (error) {
            // Rewrite some typical errors that can happen especially around symlinks
            // to something the user can better understand
            if (error.code === 'EINVAL' || error.code === 'EBUSY' || error.code === 'ENAMETOOLONG') {
                error = new Error(localize('moveError', "Unable to move '{0}' into '{1}' ({2}).", basename(fromFilePath), basename(dirname(toFilePath)), error.toString()));
            }
            throw this.toFileSystemProviderError(error);
        }
    }
    async copy(from, to, opts) {
        const fromFilePath = this.toFilePath(from);
        const toFilePath = this.toFilePath(to);
        if (fromFilePath === toFilePath) {
            return; // simulate node.js behaviour here and do a no-op if paths match
        }
        try {
            // Validate the copy operation can perform
            await this.validateMoveCopy(from, to, 'copy', opts.overwrite);
            // Copy
            await Promises.copy(fromFilePath, toFilePath, { preserveSymlinks: true });
        }
        catch (error) {
            // Rewrite some typical errors that can happen especially around symlinks
            // to something the user can better understand
            if (error.code === 'EINVAL' || error.code === 'EBUSY' || error.code === 'ENAMETOOLONG') {
                error = new Error(localize('copyError', "Unable to copy '{0}' into '{1}' ({2}).", basename(fromFilePath), basename(dirname(toFilePath)), error.toString()));
            }
            throw this.toFileSystemProviderError(error);
        }
    }
    async validateMoveCopy(from, to, mode, overwrite) {
        const fromFilePath = this.toFilePath(from);
        const toFilePath = this.toFilePath(to);
        let isSameResourceWithDifferentPathCase = false;
        const isPathCaseSensitive = !!(this.capabilities & 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */);
        if (!isPathCaseSensitive) {
            isSameResourceWithDifferentPathCase = isEqual(fromFilePath, toFilePath, true /* ignore case */);
        }
        if (isSameResourceWithDifferentPathCase) {
            // You cannot copy the same file to the same location with different
            // path case unless you are on a case sensitive file system
            if (mode === 'copy') {
                throw createFileSystemProviderError(localize('fileCopyErrorPathCase', "File cannot be copied to same path with different path case"), FileSystemProviderErrorCode.FileExists);
            }
            // You can move the same file to the same location with different
            // path case on case insensitive file systems
            else if (mode === 'move') {
                return;
            }
        }
        // Here we have to see if the target to move/copy to exists or not.
        // We need to respect the `overwrite` option to throw in case the
        // target exists.
        const fromStat = await this.statIgnoreError(from);
        if (!fromStat) {
            throw createFileSystemProviderError(localize('fileMoveCopyErrorNotFound', "File to move/copy does not exist"), FileSystemProviderErrorCode.FileNotFound);
        }
        const toStat = await this.statIgnoreError(to);
        if (!toStat) {
            return; // target does not exist so we are good
        }
        if (!overwrite) {
            throw createFileSystemProviderError(localize('fileMoveCopyErrorExists', "File at target already exists and thus will not be moved/copied to unless overwrite is specified"), FileSystemProviderErrorCode.FileExists);
        }
        // Handle existing target for move/copy
        if ((fromStat.type & FileType.File) !== 0 && (toStat.type & FileType.File) !== 0) {
            return; // node.js can move/copy a file over an existing file without having to delete it first
        }
        else {
            await this.delete(to, { recursive: true, useTrash: false, atomic: false });
        }
    }
    //#endregion
    //#region Clone File
    async cloneFile(from, to) {
        return this.doCloneFile(from, to, false /* optimistically assume parent folders exist */);
    }
    async doCloneFile(from, to, mkdir) {
        const fromFilePath = this.toFilePath(from);
        const toFilePath = this.toFilePath(to);
        const isPathCaseSensitive = !!(this.capabilities & 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */);
        if (isEqual(fromFilePath, toFilePath, !isPathCaseSensitive)) {
            return; // cloning is only supported `from` and `to` are different files
        }
        // Implement clone by using `fs.copyFile`, however setup locks
        // for both `from` and `to` because node.js does not ensure
        // this to be an atomic operation
        const locks = new DisposableStore();
        try {
            locks.add(await this.createResourceLock(from));
            locks.add(await this.createResourceLock(to));
            if (mkdir) {
                await promises.mkdir(dirname(toFilePath), { recursive: true });
            }
            await promises.copyFile(fromFilePath, toFilePath);
        }
        catch (error) {
            if (error.code === 'ENOENT' && !mkdir) {
                return this.doCloneFile(from, to, true);
            }
            throw this.toFileSystemProviderError(error);
        }
        finally {
            locks.dispose();
        }
    }
    //#endregion
    //#region File Watching
    createUniversalWatcher(onChange, onLogMessage, verboseLogging) {
        return new UniversalWatcherClient(changes => onChange(changes), msg => onLogMessage(msg), verboseLogging);
    }
    createNonRecursiveWatcher(onChange, onLogMessage, verboseLogging) {
        return new NodeJSWatcherClient(changes => onChange(changes), msg => onLogMessage(msg), verboseLogging);
    }
    //#endregion
    //#region Helpers
    toFileSystemProviderError(error) {
        if (error instanceof FileSystemProviderError) {
            return error; // avoid double conversion
        }
        let resultError = error;
        let code;
        switch (error.code) {
            case 'ENOENT':
                code = FileSystemProviderErrorCode.FileNotFound;
                break;
            case 'EISDIR':
                code = FileSystemProviderErrorCode.FileIsADirectory;
                break;
            case 'ENOTDIR':
                code = FileSystemProviderErrorCode.FileNotADirectory;
                break;
            case 'EEXIST':
                code = FileSystemProviderErrorCode.FileExists;
                break;
            case 'EPERM':
            case 'EACCES':
                code = FileSystemProviderErrorCode.NoPermissions;
                break;
            case 'ERR_UNC_HOST_NOT_ALLOWED':
                resultError = `${error.message}. Please update the 'security.allowedUNCHosts' setting if you want to allow this host.`;
                code = FileSystemProviderErrorCode.Unknown;
                break;
            default:
                code = FileSystemProviderErrorCode.Unknown;
        }
        return createFileSystemProviderError(resultError, code);
    }
    async toFileSystemProviderWriteError(resource, error) {
        let fileSystemProviderWriteError = this.toFileSystemProviderError(error);
        // If the write error signals permission issues, we try
        // to read the file's mode to see if the file is write
        // locked.
        if (resource && fileSystemProviderWriteError.code === FileSystemProviderErrorCode.NoPermissions) {
            try {
                const { stat } = await SymlinkSupport.stat(this.toFilePath(resource));
                if (!(stat.mode & 0o200 /* File mode indicating writable by owner */)) {
                    fileSystemProviderWriteError = createFileSystemProviderError(error, FileSystemProviderErrorCode.FileWriteLocked);
                }
            }
            catch (error) {
                this.logService.trace(error); // ignore - return original error
            }
        }
        return fileSystemProviderWriteError;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlza0ZpbGVTeXN0ZW1Qcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9maWxlcy9ub2RlL2Rpc2tGaWxlU3lzdGVtUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFTLFFBQVEsRUFBRSxNQUFNLElBQUksQ0FBQztBQUNyQyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUMxRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFMUQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9GLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDdEUsT0FBTyxFQUFFLDBCQUEwQixFQUFFLFFBQVEsRUFBRSxRQUFRLElBQUksaUJBQWlCLEVBQUUsT0FBTyxJQUFJLGdCQUFnQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDckosT0FBTyxFQUFFLGtCQUFrQixFQUF3QixNQUFNLGdDQUFnQyxDQUFDO0FBRTFGLE9BQU8sRUFBVyxRQUFRLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzFGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzQyxPQUFPLEVBQUUsNkJB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