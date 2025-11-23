/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isUNC, toSlashes } from '../../../base/common/extpath.js';
import * as json from '../../../base/common/json.js';
import * as jsonEdit from '../../../base/common/jsonEdit.js';
import { normalizeDriveLetter } from '../../../base/common/labels.js';
import { Schemas } from '../../../base/common/network.js';
import { isAbsolute, posix } from '../../../base/common/path.js';
import { isLinux, isMacintosh, isWindows } from '../../../base/common/platform.js';
import { isEqualAuthority } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { getRemoteAuthority } from '../../remote/common/remoteHosts.js';
import { WorkspaceFolder } from '../../workspace/common/workspace.js';
export const IWorkspacesService = createDecorator('workspacesService');
export function isRecentWorkspace(curr) {
    return curr.hasOwnProperty('workspace');
}
export function isRecentFolder(curr) {
    return curr.hasOwnProperty('folderUri');
}
export function isRecentFile(curr) {
    return curr.hasOwnProperty('fileUri');
}
//#endregion
//#region Workspace File Utilities
export function isStoredWorkspaceFolder(obj) {
    return isRawFileWorkspaceFolder(obj) || isRawUriWorkspaceFolder(obj);
}
function isRawFileWorkspaceFolder(obj) {
    const candidate = obj;
    return typeof candidate?.path === 'string' && (!candidate.name || typeof candidate.name === 'string');
}
function isRawUriWorkspaceFolder(obj) {
    const candidate = obj;
    return typeof candidate?.uri === 'string' && (!candidate.name || typeof candidate.name === 'string');
}
/**
 * Given a folder URI and the workspace config folder, computes the `IStoredWorkspaceFolder`
 * using a relative or absolute path or a uri.
 * Undefined is returned if the `folderURI` and the `targetConfigFolderURI` don't have the
 * same schema or authority.
 *
 * @param folderURI a workspace folder
 * @param forceAbsolute if set, keep the path absolute
 * @param folderName a workspace name
 * @param targetConfigFolderURI the folder where the workspace is living in
 */
export function getStoredWorkspaceFolder(folderURI, forceAbsolute, folderName, targetConfigFolderURI, extUri) {
    // Scheme mismatch: use full absolute URI as `uri`
    if (folderURI.scheme !== targetConfigFolderURI.scheme) {
        return { name: folderName, uri: folderURI.toString(true) };
    }
    // Always prefer a relative path if possible unless
    // prevented to make the workspace file shareable
    // with other users
    let folderPath = !forceAbsolute ? extUri.relativePath(targetConfigFolderURI, folderURI) : undefined;
    if (folderPath !== undefined) {
        if (folderPath.length === 0) {
            folderPath = '.';
        }
        else {
            if (isWindows) {
                folderPath = massagePathForWindows(folderPath);
            }
        }
    }
    // We could not resolve a relative path
    else {
        // Local file: use `fsPath`
        if (folderURI.scheme === Schemas.file) {
            folderPath = folderURI.fsPath;
            if (isWindows) {
                folderPath = massagePathForWindows(folderPath);
            }
        }
        // Different authority: use full absolute URI
        else if (!extUri.isEqualAuthority(folderURI.authority, targetConfigFolderURI.authority)) {
            return { name: folderName, uri: folderURI.toString(true) };
        }
        // Non-local file: use `path` of URI
        else {
            folderPath = folderURI.path;
        }
    }
    return { name: folderName, path: folderPath };
}
function massagePathForWindows(folderPath) {
    // Drive letter should be upper case
    folderPath = normalizeDriveLetter(folderPath);
    // Always prefer slash over backslash unless
    // we deal with UNC paths where backslash is
    // mandatory.
    if (!isUNC(folderPath)) {
        folderPath = toSlashes(folderPath);
    }
    return folderPath;
}
export function toWorkspaceFolders(configuredFolders, workspaceConfigFile, extUri) {
    const result = [];
    const seen = new Set();
    const relativeTo = extUri.dirname(workspaceConfigFile);
    for (const configuredFolder of configuredFolders) {
        let uri = undefined;
        if (isRawFileWorkspaceFolder(configuredFolder)) {
            if (configuredFolder.path) {
                uri = extUri.resolvePath(relativeTo, configuredFolder.path);
            }
        }
        else if (isRawUriWorkspaceFolder(configuredFolder)) {
            try {
                uri = URI.parse(configuredFolder.uri);
                if (uri.path[0] !== posix.sep) {
                    uri = uri.with({ path: posix.sep + uri.path }); // this makes sure all workspace folder are absolute
                }
            }
            catch (e) {
                console.warn(e); // ignore
            }
        }
        if (uri) {
            // remove duplicates
            const comparisonKey = extUri.getComparisonKey(uri);
            if (!seen.has(comparisonKey)) {
                seen.add(comparisonKey);
                const name = configuredFolder.name || extUri.basenameOrAuthority(uri);
                result.push(new WorkspaceFolder({ uri, name, index: result.length }, configuredFolder));
            }
        }
    }
    return result;
}
/**
 * Rewrites the content of a workspace file to be saved at a new location.
 * Throws an exception if file is not a valid workspace file
 */
export function rewriteWorkspaceFileForNewLocation(rawWorkspaceContents, configPathURI, isFromUntitledWorkspace, targetConfigPathURI, extUri) {
    const storedWorkspace = doParseStoredWorkspace(configPathURI, rawWorkspaceContents);
    const sourceConfigFolder = extUri.dirname(configPathURI);
    const targetConfigFolder = extUri.dirname(targetConfigPathURI);
    const rewrittenFolders = [];
    for (const folder of storedWorkspace.folders) {
        const folderURI = isRawFileWorkspaceFolder(folder) ? extUri.resolvePath(sourceConfigFolder, folder.path) : URI.parse(folder.uri);
        let absolute;
        if (isFromUntitledWorkspace) {
            absolute = false; // if it was an untitled workspace, try to make paths relative
        }
        else {
            absolute = !isRawFileWorkspaceFolder(folder) || isAbsolute(folder.path); // for existing workspaces, preserve whether a path was absolute or relative
        }
        rewrittenFolders.push(getStoredWorkspaceFolder(folderURI, absolute, folder.name, targetConfigFolder, extUri));
    }
    // Preserve as much of the existing workspace as possible by using jsonEdit
    // and only changing the folders portion.
    const formattingOptions = { insertSpaces: false, tabSize: 4, eol: (isLinux || isMacintosh) ? '\n' : '\r\n' };
    const edits = jsonEdit.setProperty(rawWorkspaceContents, ['folders'], rewrittenFolders, formattingOptions);
    let newContent = jsonEdit.applyEdits(rawWorkspaceContents, edits);
    if (isEqualAuthority(storedWorkspace.remoteAuthority, getRemoteAuthority(targetConfigPathURI))) {
        // unsaved remote workspaces have the remoteAuthority set. Remove it when no longer nexessary.
        newContent = jsonEdit.applyEdits(newContent, jsonEdit.removeProperty(newContent, ['remoteAuthority'], formattingOptions));
    }
    return newContent;
}
function doParseStoredWorkspace(path, contents) {
    // Parse workspace file
    const storedWorkspace = json.parse(contents); // use fault tolerant parser
    // Filter out folders which do not have a path or uri set
    if (storedWorkspace && Array.isArray(storedWorkspace.folders)) {
        storedWorkspace.folders = storedWorkspace.folders.filter(folder => isStoredWorkspaceFolder(folder));
    }
    else {
        throw new Error(`${path} looks like an invalid workspace file.`);
    }
    return storedWorkspace;
}
function isSerializedRecentWorkspace(data) {
    const candidate = data;
    return typeof candidate?.workspace === 'object' && typeof candidate.workspace.id === 'string' && typeof candidate.workspace.configPath === 'string';
}
function isSerializedRecentFolder(data) {
    const candidate = data;
    return typeof candidate?.folderUri === 'string';
}
function isSerializedRecentFile(data) {
    const candidate = data;
    return typeof candidate?.fileUri === 'string';
}
export function restoreRecentlyOpened(data, logService) {
    const result = { workspaces: [], files: [] };
    if (data) {
        const restoreGracefully = function (entries, onEntry) {
            for (let i = 0; i < entries.length; i++) {
                try {
                    onEntry(entries[i], i);
                }
                catch (e) {
                    logService.warn(`Error restoring recent entry ${JSON.stringify(entries[i])}: ${e.toString()}. Skip entry.`);
                }
            }
        };
        const storedRecents = data;
        if (Array.isArray(storedRecents.entries)) {
            restoreGracefully(storedRecents.entries, entry => {
                const label = entry.label;
                const remoteAuthority = entry.remoteAuthority;
                if (isSerializedRecentWorkspace(entry)) {
                    result.workspaces.push({ label, remoteAuthority, workspace: { id: entry.workspace.id, configPath: URI.parse(entry.workspace.configPath) } });
                }
                else if (isSerializedRecentFolder(entry)) {
                    result.workspaces.push({ label, remoteAuthority, folderUri: URI.parse(entry.folderUri) });
                }
                else if (isSerializedRecentFile(entry)) {
                    result.files.push({ label, remoteAuthority, fileUri: URI.parse(entry.fileUri) });
                }
            });
        }
    }
    return result;
}
export function toStoreData(recents) {
    const serialized = { entries: [] };
    const storeLabel = (label, uri) => {
        // Only store the label if it is provided
        // and only if it differs from the path
        // This gives us a chance to render the
        // path better, e.g. use `~` for home.
        return label && label !== uri.fsPath && label !== uri.path;
    };
    for (const recent of recents.workspaces) {
        if (isRecentFolder(recent)) {
            serialized.entries.push({
                folderUri: recent.folderUri.toString(),
                label: storeLabel(recent.label, recent.folderUri) ? recent.label : undefined,
                remoteAuthority: recent.remoteAuthority
            });
        }
        else {
            serialized.entries.push({
                workspace: {
                    id: recent.workspace.id,
                    configPath: recent.workspace.configPath.toString()
                },
                label: storeLabel(recent.label, recent.workspace.configPath) ? recent.label : undefined,
                remoteAuthority: recent.remoteAuthority
            });
        }
    }
    for (const recent of recents.files) {
        serialized.entries.push({
            fileUri: recent.fileUri.toString(),
            label: storeLabel(recent.label, recent.fileUri) ? recent.label : undefined,
            remoteAuthority: recent.remoteAuthority
        });
    }
    return serialized;
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbkUsT0FBTyxLQUFLLElBQUksTUFBTSw4QkFBOEIsQ0FBQztBQUNyRCxPQUFPLEtBQUssUUFBUSxNQUFNLGtDQUFrQyxDQUFDO0FBRTdELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ25GLE9BQU8sRUFBVyxnQkFBZ0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUVsRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFOUUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDeEUsT0FBTyxFQUF5RixlQUFlLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUU3SixNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRyxlQUFlLENBQXFCLG1CQUFtQixDQUFDLENBQUM7QUFrRDNGLE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxJQUFhO0lBQzlDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN6QyxDQUFDO0FBRUQsTUFBTSxVQUFVLGNB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