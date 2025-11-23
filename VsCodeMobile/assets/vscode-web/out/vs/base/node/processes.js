/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as cp from 'child_process';
import { promises } from 'fs';
import { getCaseInsensitive } from '../common/objects.js';
import * as path from '../common/path.js';
import * as Platform from '../common/platform.js';
import * as processCommon from '../common/process.js';
import { Source, TerminateResponseCode } from '../common/processes.js';
import * as Types from '../common/types.js';
import * as pfs from './pfs.js';
import { FileAccess } from '../common/network.js';
export { Source, TerminateResponseCode };
export function getWindowsShell(env = processCommon.env) {
    return env['comspec'] || 'cmd.exe';
}
// Wrapper around process.send() that will queue any messages if the internal node.js
// queue is filled with messages and only continue sending messages when the internal
// queue is free again to consume messages.
// On Windows we always wait for the send() method to return before sending the next message
// to workaround https://github.com/nodejs/node/issues/7657 (IPC can freeze process)
export function createQueuedSender(childProcess) {
    let msgQueue = [];
    let useQueue = false;
    const send = function (msg) {
        if (useQueue) {
            msgQueue.push(msg); // add to the queue if the process cannot handle more messages
            return;
        }
        const result = childProcess.send(msg, (error) => {
            if (error) {
                console.error(error); // unlikely to happen, best we can do is log this error
            }
            useQueue = false; // we are good again to send directly without queue
            // now send all the messages that we have in our queue and did not send yet
            if (msgQueue.length > 0) {
                const msgQueueCopy = msgQueue.slice(0);
                msgQueue = [];
                msgQueueCopy.forEach(entry => send(entry));
            }
        });
        if (!result || Platform.isWindows /* workaround https://github.com/nodejs/node/issues/7657 */) {
            useQueue = true;
        }
    };
    return { send };
}
async function fileExistsDefault(path) {
    if (await pfs.Promises.exists(path)) {
        let statValue;
        try {
            statValue = await promises.stat(path);
        }
        catch (e) {
            if (e.message.startsWith('EACCES')) {
                // it might be symlink
                statValue = await promises.lstat(path);
            }
        }
        return statValue ? !statValue.isDirectory() : false;
    }
    return false;
}
export async function findExecutable(command, cwd, paths, env = processCommon.env, fileExists = fileExistsDefault) {
    // If we have an absolute path then we take it.
    if (path.isAbsolute(command)) {
        return await fileExists(command) ? command : undefined;
    }
    if (cwd === undefined) {
        cwd = processCommon.cwd();
    }
    const dir = path.dirname(command);
    if (dir !== '.') {
        // We have a directory and the directory is relative (see above). Make the path absolute
        // to the current working directory.
        const fullPath = path.join(cwd, command);
        return await fileExists(fullPath) ? fullPath : undefined;
    }
    const envPath = getCaseInsensitive(env, 'PATH');
    if (paths === undefined && Types.isString(envPath)) {
        paths = envPath.split(path.delimiter);
    }
    // No PATH environment. Make path absolute to the cwd.
    if (paths === undefined || paths.length === 0) {
        const fullPath = path.join(cwd, command);
        return await fileExists(fullPath) ? fullPath : undefined;
    }
    // We have a simple file name. We get the path variable from the env
    // and try to find the executable on the path.
    for (const pathEntry of paths) {
        // The path entry is absolute.
        let fullPath;
        if (path.isAbsolute(pathEntry)) {
            fullPath = path.join(pathEntry, command);
        }
        else {
            fullPath = path.join(cwd, pathEntry, command);
        }
        if (Platform.isWindows) {
            const pathExt = getCaseInsensitive(env, 'PATHEXT') || '.COM;.EXE;.BAT;.CMD';
            const pathExtsFound = pathExt.split(';').map(async (ext) => {
                const withExtension = fullPath + ext;
                return await fileExists(withExtension) ? withExtension : undefined;
            });
            for (const foundPromise of pathExtsFound) {
                const found = await foundPromise;
                if (found) {
                    return found;
                }
            }
        }
        if (await fileExists(fullPath)) {
            return fullPath;
        }
    }
    const fullPath = path.join(cwd, command);
    return await fileExists(fullPath) ? fullPath : undefined;
}
/**
 * Kills a process and all its children.
 * @param pid the process id to kill
 * @param forceful whether to forcefully kill the process (default: false). Note
 * that on Windows, terminal processes can _only_ be killed forcefully and this
 * will throw when not forceful.
 */
export async function killTree(pid, forceful = false) {
    let child;
    if (Platform.isWindows) {
        const windir = process.env['WINDIR'] || 'C:\\Windows';
        const taskKill = path.join(windir, 'System32', 'taskkill.exe');
        const args = ['/T'];
        if (forceful) {
            args.push('/F');
        }
        args.push('/PID', String(pid));
        child = cp.spawn(taskKill, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    }
    else {
        const killScript = FileAccess.asFileUri('vs/base/node/terminateProcess.sh').fsPath;
        child = cp.spawn('/bin/sh', [killScript, String(pid), forceful ? '9' : '15'], { stdio: ['ignore', 'pipe', 'pipe'] });
    }
    return new Promise((resolve, reject) => {
        const stdout = [];
        child.stdout.on('data', (data) => stdout.push(data));
        child.stderr.on('data', (data) => stdout.push(data));
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`taskkill exited with code ${code}: ${Buffer.concat(stdout).toString()}`));
            }
        });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzc2VzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2Uvbm9kZS9wcm9jZXNzZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDcEMsT0FBTyxFQUFTLFFBQVEsRUFBRSxNQUFNLElBQUksQ0FBQztBQUNyQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUMxRCxPQUFPLEtBQUssSUFBSSxNQUFNLG1CQUFtQixDQUFDO0FBQzFDLE9BQU8sS0FBSyxRQUFRLE1BQU0sdUJBQXVCLENBQUM7QUFDbEQsT0FBTyxLQUFLLGFBQWEsTUFBTSxzQkFBc0IsQ0FBQztBQUN0RCxPQUFPLEVBQStCLE1BQU0sRUFBa0MscUJBQXFCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNwSSxPQUFPLEtBQUssS0FBSyxNQUFNLG9CQUFvQixDQUFDO0FBQzVDLE9BQU8sS0FBSyxHQUFHLE1BQU0sVUFBVSxDQUFDO0FBQ2hDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUVsRCxPQUFPLEVBQUUsTUFBTSxFQUFFLHFCQUFxQixFQUFtRixDQUFDO0FBTzFILE1BQU0sVUFBVSxlQUFlLENBQUMsR0FBRyxHQUFHLGFBQWEsQ0FBQyxHQUFHO0lBQ3RELE9BQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLFNBQVMsQ0FBQztBQUNwQyxDQUFDO0FBTUQscUZBQXFGO0FBQ3JGLHFGQUFxRjtBQUNyRiwyQ0FBMkM7QUFDM0MsNEZBQTRGO0FBQzVGLG9GQUFvRjtBQUNwRixNQUFNLFVBQVUsa0JBQWtCLENBQUMsWUFBNkI7SUFDL0QsSUFBSSxRQUFRLEdBQWEsRUFBRSxDQUFDO0lBQzVCLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQztJQUVyQixNQUFNLElBQUksR0FB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