/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { ResourceQueue, timeout } from '../common/async.js';
import { isEqualOrParent, isRootOrDriveLetter, randomPath } from '../common/extpath.js';
import { normalizeNFC } from '../common/normalization.js';
import { basename, dirname, join, normalize, sep } from '../common/path.js';
import { isLinux, isMacintosh, isWindows } from '../common/platform.js';
import { extUriBiasedIgnorePathCase } from '../common/resources.js';
import { URI } from '../common/uri.js';
import { rtrim } from '../common/strings.js';
//#region rimraf
export var RimRafMode;
(function (RimRafMode) {
    /**
     * Slow version that unlinks each file and folder.
     */
    RimRafMode[RimRafMode["UNLINK"] = 0] = "UNLINK";
    /**
     * Fast version that first moves the file/folder
     * into a temp directory and then deletes that
     * without waiting for it.
     */
    RimRafMode[RimRafMode["MOVE"] = 1] = "MOVE";
})(RimRafMode || (RimRafMode = {}));
async function rimraf(path, mode = RimRafMode.UNLINK, moveToPath) {
    if (isRootOrDriveLetter(path)) {
        throw new Error('rimraf - will refuse to recursively delete root');
    }
    // delete: via rm
    if (mode === RimRafMode.UNLINK) {
        return rimrafUnlink(path);
    }
    // delete: via move
    return rimrafMove(path, moveToPath);
}
async function rimrafMove(path, moveToPath = randomPath(tmpdir())) {
    try {
        try {
            await fs.promises.rename(path, moveToPath);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return; // ignore - path to delete did not exist
            }
            return rimrafUnlink(path); // otherwise fallback to unlink
        }
        // Delete but do not return as promise
        rimrafUnlink(moveToPath).catch(() => { });
    }
    catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}
async function rimrafUnlink(path) {
    return fs.promises.rm(path, { recursive: true, force: true, maxRetries: 3 });
}
async function readdir(path, options) {
    try {
        return await doReaddir(path, options);
    }
    catch (error) {
        // Workaround for #252361 that should be removed once the upstream issue
        // in node.js is resolved. Adds a trailing dot to a root drive letter path
        // (G:\ => G:\.) as a workaround.
        if (error.code === 'ENOENT' && isWindows && isRootOrDriveLetter(path)) {
            try {
                return await doReaddir(`${path}.`, options);
            }
            catch {
                // ignore
            }
        }
        throw error;
    }
}
async function doReaddir(path, options) {
    return handleDirectoryChildren(await (options ? safeReaddirWithFileTypes(path) : fs.promises.readdir(path)));
}
async function safeReaddirWithFileTypes(path) {
    try {
        return await fs.promises.readdir(path, { withFileTypes: true });
    }
    catch (error) {
        console.warn('[node.js fs] readdir with filetypes failed with error: ', error);
    }
    // Fallback to manually reading and resolving each
    // children of the folder in case we hit an error
    // previously.
    // This can only really happen on exotic file systems
    // such as explained in #115645 where we get entries
    // from `readdir` that we can later not `lstat`.
    const result = [];
    const children = await readdir(path);
    for (const child of children) {
        let isFile = false;
        let isDirectory = false;
        let isSymbolicLink = false;
        try {
            const lstat = await fs.promises.lstat(join(path, child));
            isFile = lstat.isFile();
            isDirectory = lstat.isDirectory();
            isSymbolicLink = lstat.isSymbolicLink();
        }
        catch (error) {
            console.warn('[node.js fs] unexpected error from lstat after readdir: ', error);
        }
        result.push({
            name: child,
            isFile: () => isFile,
            isDirectory: () => isDirectory,
            isSymbolicLink: () => isSymbolicLink
        });
    }
    return result;
}
function handleDirectoryChildren(children) {
    return children.map(child => {
        // Mac: uses NFD unicode form on disk, but we want NFC
        // See also https://github.com/nodejs/node/issues/2165
        if (typeof child === 'string') {
            return isMacintosh ? normalizeNFC(child) : child;
        }
        child.name = isMacintosh ? normalizeNFC(child.name) : child.name;
        return child;
    });
}
/**
 * A convenience method to read all children of a path that
 * are directories.
 */
async function readDirsInDir(dirPath) {
    const children = await readdir(dirPath);
    const directories = [];
    for (const child of children) {
        if (await SymlinkSupport.existsDirectory(join(dirPath, child))) {
            directories.push(child);
        }
    }
    return directories;
}
//#endregion
//#region whenDeleted()
/**
 * A `Promise` that resolves when the provided `path`
 * is deleted from disk.
 */
export function whenDeleted(path, intervalMs = 1000) {
    return new Promise(resolve => {
        let running = false;
        const interval = setInterval(() => {
            if (!running) {
                running = true;
                fs.access(path, err => {
                    running = false;
                    if (err) {
                        clearInterval(interval);
                        resolve(undefined);
                    }
                });
            }
        }, intervalMs);
    });
}
//#endregion
//#region Methods with symbolic links support
export var SymlinkSupport;
(function (SymlinkSupport) {
    /**
     * Resolves the `fs.Stats` of the provided path. If the path is a
     * symbolic link, the `fs.Stats` will be from the target it points
     * to. If the target does not exist, `dangling: true` will be returned
     * as `symbolicLink` value.
     */
    async function stat(path) {
        // First stat the link
        let lstats;
        try {
            lstats = await fs.promises.lstat(path);
            // Return early if the stat is not a symbolic link at all
            if (!lstats.isSymbolicLink()) {
                return { stat: lstats };
            }
        }
        catch {
            /* ignore - use stat() instead */
        }
        // If the stat is a symbolic link or failed to stat, use fs.stat()
        // which for symbolic links will stat the target they point to
        try {
            const stats = await fs.promises.stat(path);
            return { stat: stats, symbolicLink: lstats?.isSymbolicLink() ? { dangling: false } : undefined };
        }
        catch (error) {
            // If the link points to a nonexistent file we still want
            // to return it as result while setting dangling: true flag
            if (error.code === 'ENOENT' && lstats) {
                return { stat: lstats, symbolicLink: { dangling: true } };
            }
            // Windows: workaround a node.js bug where reparse points
            // are not supported (https://github.com/nodejs/node/issues/36790)
            if (isWindows && error.code === 'EACCES') {
                try {
                    const stats = await fs.promises.stat(await fs.promises.readlink(path));
                    return { stat: stats, symbolicLink: { dangling: false } };
                }
                catch (error) {
                    // If the link points to a nonexistent file we still want
                    // to return it as result while setting dangling: true flag
                    if (error.code === 'ENOENT' && lstats) {
                        return { stat: lstats, symbolicLink: { dangling: true } };
                    }
                    throw error;
                }
            }
            throw error;
        }
    }
    SymlinkSupport.stat = stat;
    /**
     * Figures out if the `path` exists and is a file with support
     * for symlinks.
     *
     * Note: this will return `false` for a symlink that exists on
     * disk but is dangling (pointing to a nonexistent path).
     *
     * Use `exists` if you only care about the path existing on disk
     * or not without support for symbolic links.
     */
    async function existsFile(path) {
        try {
            const { stat, symbolicLink } = await SymlinkSupport.stat(path);
            return stat.isFile() && symbolicLink?.dangling !== true;
        }
        catch {
            // Ignore, path might not exist
        }
        return false;
    }
    SymlinkSupport.existsFile = existsFile;
    /**
     * Figures out if the `path` exists and is a directory with support for
     * symlinks.
     *
     * Note: this will return `false` for a symlink that exists on
     * disk but is dangling (pointing to a nonexistent path).
     *
     * Use `exists` if you only care about the path existing on disk
     * or not without support for symbolic links.
     */
    async function existsDirectory(path) {
        try {
            const { stat, symbolicLink } = await SymlinkSupport.stat(path);
            return stat.isDirectory() && symbolicLink?.dangling !== true;
        }
        catch {
            // Ignore, path might not exist
        }
        return false;
    }
    SymlinkSupport.existsDirectory = existsDirectory;
})(SymlinkSupport || (SymlinkSupport = {}));
//#endregion
//#region Write File
// According to node.js docs (https://nodejs.org/docs/v14.16.0/api/fs.html#fs_fs_writefile_file_data_options_callback)
// it is not safe to call writeFile() on the same path multiple times without waiting for the callback to return.
// Therefor we use a Queue on the path that is given to us to sequentialize calls to the same path properly.
const writeQueues = new ResourceQueue();
function writeFile(path, data, options) {
    return writeQueues.queueFor(URI.file(path), () => {
        const ensuredOptions = ensureWriteOptions(options);
        return new Promise((resolve, reject) => doWriteFileAndFlush(path, data, ensuredOptions, error => error ? reject(error) : resolve()));
    }, extUriBiasedIgnorePathCase);
}
let canFlush = true;
export function configureFlushOnWrite(enabled) {
    canFlush = enabled;
}
// Calls fs.writeFile() followed by a fs.sync() call to flush the changes to disk
// We do this in cases where we want to make sure the data is really on disk and
// not in some cache.
//
// See https://github.com/nodejs/node/blob/v5.10.0/lib/fs.js#L1194
function doWriteFileAndFlush(path, data, options, callback) {
    if (!canFlush) {
        return fs.writeFile(path, data, { mode: options.mode, flag: options.flag }, callback);
    }
    // Open the file with same flags and mode as fs.writeFile()
    fs.open(path, options.flag, options.mode, (openError, fd) => {
        if (openError) {
            return callback(openError);
        }
        // It is valid to pass a fd handle to fs.writeFile() and this will keep the handle open!
        fs.writeFile(fd, data, writeError => {
            if (writeError) {
                return fs.close(fd, () => callback(writeError)); // still need to close the handle on error!
            }
            // Flush contents (not metadata) of the file to disk
            // https://github.com/microsoft/vscode/issues/9589
            fs.fdatasync(fd, (syncError) => {
                // In some exotic setups it is well possible that node fails to sync
                // In that case we disable flushing and warn to the console
                if (syncError) {
                    console.warn('[node.js fs] fdatasync is now disabled for this session because it failed: ', syncError);
                    configureFlushOnWrite(false);
                }
                return fs.close(fd, closeError => callback(closeError));
            });
        });
    });
}
/**
 * Same as `fs.writeFileSync` but with an additional call to
 * `fs.fdatasyncSync` after writing to ensure changes are
 * flushed to disk.
 *
 * @deprecated always prefer async variants over sync!
 */
export function writeFileSync(path, data, options) {
    const ensuredOptions = ensureWriteOptions(options);
    if (!canFlush) {
        return fs.writeFileSync(path, data, { mode: ensuredOptions.mode, flag: ensuredOptions.flag });
    }
    // Open the file with same flags and mode as fs.writeFile()
    const fd = fs.openSync(path, ensuredOptions.flag, ensuredOptions.mode);
    try {
        // It is valid to pass a fd handle to fs.writeFile() and this will keep the handle open!
        fs.writeFileSync(fd, data);
        // Flush contents (not metadata) of the file to disk
        try {
            fs.fdatasyncSync(fd); // https://github.com/microsoft/vscode/issues/9589
        }
        catch (syncError) {
            console.warn('[node.js fs] fdatasyncSync is now disabled for this session because it failed: ', syncError);
            configureFlushOnWrite(false);
        }
    }
    finally {
        fs.closeSync(fd);
    }
}
function ensureWriteOptions(options) {
    if (!options) {
        return { mode: 0o666 /* default node.js mode for files */, flag: 'w' };
    }
    return {
        mode: typeof options.mode === 'number' ? options.mode : 0o666 /* default node.js mode for files */,
        flag: typeof options.flag === 'string' ? options.flag : 'w'
    };
}
//#endregion
//#region Move / Copy
/**
 * A drop-in replacement for `fs.rename` that:
 * - allows to move across multiple disks
 * - attempts to retry the operation for certain error codes on Windows
 */
async function rename(source, target, windowsRetryTimeout = 60000) {
    if (source === target) {
        return; // simulate node.js behaviour here and do a no-op if paths match
    }
    try {
        if (isWindows && typeof windowsRetryTimeout === 'number') {
            // On Windows, a rename can fail when either source or target
            // is locked by AV software.
            await renameWithRetry(source, target, Date.now(), windowsRetryTimeout);
        }
        else {
            await fs.promises.rename(source, target);
        }
    }
    catch (error) {
        // In two cases we fallback to classic copy and delete:
        //
        // 1.) The EXDEV error indicates that source and target are on different devices
        // In this case, fallback to using a copy() operation as there is no way to
        // rename() between different devices.
        //
        // 2.) The user tries to rename a file/folder that ends with a dot. This is not
        // really possible to move then, at least on UNC devices.
        if (source.toLowerCase() !== target.toLowerCase() && error.code === 'EXDEV' || source.endsWith('.')) {
            await copy(source, target, { preserveSymlinks: false /* copying to another device */ });
            await rimraf(source, RimRafMode.MOVE);
        }
        else {
            throw error;
        }
    }
}
async function renameWithRetry(source, target, startTime, retryTimeout, attempt = 0) {
    try {
        return await fs.promises.rename(source, target);
    }
    catch (error) {
        if (error.code !== 'EACCES' && error.code !== 'EPERM' && error.code !== 'EBUSY') {
            throw error; // only for errors we think are temporary
        }
        if (Date.now() - startTime >= retryTimeout) {
            console.error(`[node.js fs] rename failed after ${attempt} retries with error: ${error}`);
            throw error; // give up after configurable timeout
        }
        if (attempt === 0) {
            let abortRetry = false;
            try {
                const { stat } = await SymlinkSupport.stat(target);
                if (!stat.isFile()) {
                    abortRetry = true; // if target is not a file, EPERM error may be raised and we should not attempt to retry
                }
            }
            catch {
                // Ignore
            }
            if (abortRetry) {
                throw error;
            }
        }
        // Delay with incremental backoff up to 100ms
        await timeout(Math.min(100, attempt * 10));
        // Attempt again
        return renameWithRetry(source, target, startTime, retryTimeout, attempt + 1);
    }
}
/**
 * Recursively copies all of `source` to `target`.
 *
 * The options `preserveSymlinks` configures how symbolic
 * links should be handled when encountered. Set to
 * `false` to not preserve them and `true` otherwise.
 */
async function copy(source, target, options) {
    return doCopy(source, target, { root: { source, target }, options, handledSourcePaths: new Set() });
}
// When copying a file or folder, we want to preserve the mode
// it had and as such provide it when creating. However, modes
// can go beyond what we expect (see link below), so we mask it.
// (https://github.com/nodejs/node-v0.x-archive/issues/3045#issuecomment-4862588)
const COPY_MODE_MASK = 0o777;
async function doCopy(source, target, payload) {
    // Keep track of paths already copied to prevent
    // cycles from symbolic links to cause issues
    if (payload.handledSourcePaths.has(source)) {
        return;
    }
    else {
        payload.handledSourcePaths.add(source);
    }
    const { stat, symbolicLink } = await SymlinkSupport.stat(source);
    // Symlink
    if (symbolicLink) {
        // Try to re-create the symlink unless `preserveSymlinks: false`
        if (payload.options.preserveSymlinks) {
            try {
                return await doCopySymlink(source, target, payload);
            }
            catch {
                // in any case of an error fallback to normal copy via dereferencing
            }
        }
        if (symbolicLink.dangling) {
            return; // skip dangling symbolic links from here on (https://github.com/microsoft/vscode/issues/111621)
        }
    }
    // Folder
    if (stat.isDirectory()) {
        return doCopyDirectory(source, target, stat.mode & COPY_MODE_MASK, payload);
    }
    // File or file-like
    else {
        return doCopyFile(source, target, stat.mode & COPY_MODE_MASK);
    }
}
async function doCopyDirectory(source, target, mode, payload) {
    // Create folder
    await fs.promises.mkdir(target, { recursive: true, mode });
    // Copy each file recursively
    const files = await readdir(source);
    for (const file of files) {
        await doCopy(join(source, file), join(target, file), payload);
    }
}
async function doCopyFile(source, target, mode) {
    // Copy file
    await fs.promises.copyFile(source, target);
    // restore mode (https://github.com/nodejs/node/issues/1104)
    await fs.promises.chmod(target, mode);
}
async function doCopySymlink(source, target, payload) {
    // Figure out link target
    let linkTarget = await fs.promises.readlink(source);
    // Special case: the symlink points to a target that is
    // actually within the path that is being copied. In that
    // case we want the symlink to point to the target and
    // not the source
    if (isEqualOrParent(linkTarget, payload.root.source, !isLinux)) {
        linkTarget = join(payload.root.target, linkTarget.substr(payload.root.source.length + 1));
    }
    // Create symlink
    await fs.promises.symlink(linkTarget, target);
}
//#endregion
//#region Path resolvers
/**
 * Given an absolute, normalized, and existing file path 'realcase' returns the
 * exact path that the file has on disk.
 * On a case insensitive file system, the returned path might differ from the original
 * path by character casing.
 * On a case sensitive file system, the returned path will always be identical to the
 * original path.
 * In case of errors, null is returned. But you cannot use this function to verify that
 * a path exists.
 *
 * realcase does not handle '..' or '.' path segments and it does not take the locale into account.
 */
export async function realcase(path, token) {
    if (isLinux) {
        // This method is unsupported on OS that have case sensitive
        // file system where the same path can exist in different forms
        // (see also https://github.com/microsoft/vscode/issues/139709)
        return path;
    }
    const dir = dirname(path);
    if (path === dir) { // end recursion
        return path;
    }
    const name = (basename(path) /* can be '' for windows drive letters */ || path).toLowerCase();
    try {
        if (token?.isCancellationRequested) {
            return null;
        }
        const entries = await Promises.readdir(dir);
        const found = entries.filter(e => e.toLowerCase() === name); // use a case insensitive search
        if (found.length === 1) {
            // on a case sensitive filesystem we cannot determine here, whether the file exists or not, hence we need the 'file exists' precondition
            const prefix = await realcase(dir, token); // recurse
            if (prefix) {
                return join(prefix, found[0]);
            }
        }
        else if (found.length > 1) {
            // must be a case sensitive $filesystem
            const ix = found.indexOf(name);
            if (ix >= 0) { // case sensitive
                const prefix = await realcase(dir, token); // recurse
                if (prefix) {
                    return join(prefix, found[ix]);
                }
            }
        }
    }
    catch {
        // silently ignore error
    }
    return null;
}
async function realpath(path) {
    try {
        // DO NOT USE `fs.promises.realpath` here as it internally
        // calls `fs.native.realpath` which will result in subst
        // drives to be resolved to their target on Windows
        // https://github.com/microsoft/vscode/issues/118562
        return await promisify(fs.realpath)(path);
    }
    catch {
        // We hit an error calling fs.realpath(). Since fs.realpath() is doing some path normalization
        // we now do a similar normalization and then try again if we can access the path with read
        // permissions at least. If that succeeds, we return that path.
        // fs.realpath() is resolving symlinks and that can fail in certain cases. The workaround is
        // to not resolve links but to simply see if the path is read accessible or not.
        const normalizedPath = normalizePath(path);
        await fs.promises.access(normalizedPath, fs.constants.R_OK);
        return normalizedPath;
    }
}
/**
 * @deprecated always prefer async variants over sync!
 */
export function realpathSync(path) {
    try {
        return fs.realpathSync(path);
    }
    catch {
        // We hit an error calling fs.realpathSync(). Since fs.realpathSync() is doing some path normalization
        // we now do a similar normalization and then try again if we can access the path with read
        // permissions at least. If that succeeds, we return that path.
        // fs.realpath() is resolving symlinks and that can fail in certain cases. The workaround is
        // to not resolve links but to simply see if the path is read accessible or not.
        const normalizedPath = normalizePath(path);
        fs.accessSync(normalizedPath, fs.constants.R_OK); // throws in case of an error
        return normalizedPath;
    }
}
function normalizePath(path) {
    return rtrim(normalize(path), sep);
}
//#endregion
//#region Promise based fs methods
/**
 * Some low level `fs` methods provided as `Promises` similar to
 * `fs.promises` but with notable differences, either implemented
 * by us or by restoring the original callback based behavior.
 *
 * At least `realpath` is implemented differently in the promise
 * based implementation compared to the callback based one. The
 * promise based implementation actually calls `fs.realpath.native`.
 * (https://github.com/microsoft/vscode/issues/118562)
 */
export const Promises = new class {
    //#region Implemented by node.js
    get read() {
        // Not using `promisify` here for a reason: the return
        // type is not an object as indicated by TypeScript but
        // just the bytes read, so we create our own wrapper.
        return (fd, buffer, offset, length, position) => {
            return new Promise((resolve, reject) => {
                fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve({ bytesRead, buffer });
                });
            });
        };
    }
    get write() {
        // Not using `promisify` here for a reason: the return
        // type is not an object as indicated by TypeScript but
        // just the bytes written, so we create our own wrapper.
        return (fd, buffer, offset, length, position) => {
            return new Promise((resolve, reject) => {
                fs.write(fd, buffer, offset, length, position, (err, bytesWritten, buffer) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve({ bytesWritten, buffer });
                });
            });
        };
    }
    get fdatasync() { return promisify(fs.fdatasync); } // not exposed as API in 22.x yet
    get open() { return promisify(fs.open); } // changed to return `FileHandle` in promise API
    get close() { return promisify(fs.close); } // not exposed as API due to the `FileHandle` return type of `open`
    get ftruncate() { return promisify(fs.ftruncate); } // not exposed as API in 22.x yet
    //#endregion
    //#region Implemented by us
    async exists(path) {
        try {
            await fs.promises.access(path);
            return true;
        }
        catch {
            return false;
        }
    }
    get readdir() { return readdir; }
    get readDirsInDir() { return readDirsInDir; }
    get writeFile() { return writeFile; }
    get rm() { return rimraf; }
    get rename() { return rename; }
    get copy() { return copy; }
    get realpath() { return realpath; } // `fs.promises.realpath` will use `fs.realpath.native` which we do not want
};
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGZzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2Uvbm9kZS9wZnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLElBQUksQ0FBQztBQUM1QixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ2pDLE9BQU8sRUFBRSxhQUFhLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDNUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxVQUFVLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUN4RixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDMUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUM1RSxPQUFPLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUN4RSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNwRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFFdkMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRTdDLGdCQUFnQjtBQUVoQixNQUFNLENBQU4sSUFBWSxVQWFYO0FBYkQsV0FBWSxVQUFVO0lBRXJCOztPQUVHO0lBQ0gsK0NBQU0sQ0FBQTtJQUVOOzs7O09BSUc7SUFDSCwyQ0FBSSxDQUFBO0FBQ0wsQ0FBQyxFQWJXLFVBQVUsS0FBVixVQUFVLFFBYXJCO0FBY0QsS0FBSyxVQUFVLE1BQU0sQ0FBQyxJQUFZLEVBQUUsSUFBSSxHQUFHLFVBQVUs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