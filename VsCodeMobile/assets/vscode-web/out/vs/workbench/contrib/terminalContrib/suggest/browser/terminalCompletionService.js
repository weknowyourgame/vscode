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
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { basename } from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { Emitter } from '../../../../../base/common/event.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ITerminalLogService } from '../../../../../platform/terminal/common/terminal.js';
import { TerminalCompletionItemKind } from './terminalCompletionItem.js';
import { env as processEnv } from '../../../../../base/common/process.js';
import { timeout } from '../../../../../base/common/async.js';
import { gitBashToWindowsPath, windowsToGitBashPath } from './terminalGitBashHelpers.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { match } from '../../../../../base/common/glob.js';
import { isString } from '../../../../../base/common/types.js';
export const ITerminalCompletionService = createDecorator('terminalCompletionService');
/**
 * Represents a collection of {@link CompletionItem completion items} to be presented
 * in the terminal.
 */
export class TerminalCompletionList {
    /**
     * Creates a new completion list.
     *
     * @param items The completion items.
     * @param isIncomplete The list is not complete.
     */
    constructor(items, resourceOptions) {
        this.items = items;
        this.resourceOptions = resourceOptions;
    }
}
let TerminalCompletionService = class TerminalCompletionService extends Disposable {
    get providers() {
        return this._providersGenerator();
    }
    *_providersGenerator() {
        for (const providerMap of this._providers.values()) {
            for (const provider of providerMap.values()) {
                yield provider;
            }
        }
    }
    /** Overrides the environment for testing purposes. */
    set processEnv(env) { this._processEnv = env; }
    constructor(_configurationService, _fileService, _labelService, _logService) {
        super();
        this._configurationService = _configurationService;
        this._fileService = _fileService;
        this._labelService = _labelService;
        this._logService = _logService;
        this._providers = new Map();
        this._onDidChangeProviders = this._register(new Emitter());
        this.onDidChangeProviders = this._onDidChangeProviders.event;
        this._processEnv = processEnv;
    }
    registerTerminalCompletionProvider(extensionIdentifier, id, provider, ...triggerCharacters) {
        let extMap = this._providers.get(extensionIdentifier);
        if (!extMap) {
            extMap = new Map();
            this._providers.set(extensionIdentifier, extMap);
        }
        provider.triggerCharacters = triggerCharacters;
        provider.id = id;
        extMap.set(id, provider);
        this._onDidChangeProviders.fire();
        return toDisposable(() => {
            const extMap = this._providers.get(extensionIdentifier);
            if (extMap) {
                extMap.delete(id);
                if (extMap.size === 0) {
                    this._providers.delete(extensionIdentifier);
                }
            }
            this._onDidChangeProviders.fire();
        });
    }
    async provideCompletions(promptValue, cursorPosition, allowFallbackCompletions, shellType, capabilities, token, triggerCharacter, skipExtensionCompletions, explicitlyInvoked) {
        this._logService.trace('TerminalCompletionService#provideCompletions');
        if (!this._providers || !this._providers.values || cursorPosition < 0) {
            return undefined;
        }
        let providers;
        if (triggerCharacter) {
            const providersToRequest = [];
            for (const provider of this.providers) {
                if (!provider.triggerCharacters) {
                    continue;
                }
                for (const char of provider.triggerCharacters) {
                    if (promptValue.substring(0, cursorPosition)?.endsWith(char)) {
                        providersToRequest.push(provider);
                        break;
                    }
                }
            }
            providers = providersToRequest;
        }
        else {
            providers = [...this._providers.values()].flatMap(providerMap => [...providerMap.values()]);
        }
        if (skipExtensionCompletions) {
            providers = providers.filter(p => p.isBuiltin);
            return this._collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token, explicitlyInvoked);
        }
        providers = this._getEnabledProviders(providers);
        if (!providers.length) {
            return;
        }
        return this._collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token, explicitlyInvoked);
    }
    _getEnabledProviders(providers) {
        const providerConfig = this._configurationService.getValue("terminal.integrated.suggest.providers" /* TerminalSuggestSettingId.Providers */);
        return providers.filter(p => {
            const providerId = p.id;
            return providerId && (!Object.prototype.hasOwnProperty.call(providerConfig, providerId) || providerConfig[providerId] !== false);
        });
    }
    async _collectCompletions(providers, shellType, promptValue, cursorPosition, allowFallbackCompletions, capabilities, token, explicitlyInvoked) {
        this._logService.trace('TerminalCompletionService#_collectCompletions');
        const completionPromises = providers.map(async (provider) => {
            if (provider.shellTypes && shellType && !provider.shellTypes.includes(shellType)) {
                return undefined;
            }
            const timeoutMs = explicitlyInvoked ? 30000 : 5000;
            let timedOut = false;
            let completions;
            try {
                completions = await Promise.race([
                    provider.provideCompletions(promptValue, cursorPosition, token).then(result => {
                        this._logService.trace(`TerminalCompletionService#_collectCompletions provider ${provider.id} finished`);
                        return result;
                    }),
                    (async () => { await timeout(timeoutMs); timedOut = true; return undefined; })()
                ]);
            }
            catch (e) {
                this._logService.trace(`[TerminalCompletionService] Exception from provider '${provider.id}':`, e);
                return undefined;
            }
            if (timedOut) {
                this._logService.trace(`[TerminalCompletionService] Provider '${provider.id}' timed out after ${timeoutMs}ms. promptValue='${promptValue}', cursorPosition=${cursorPosition}, explicitlyInvoked=${explicitlyInvoked}`);
                return undefined;
            }
            if (!completions) {
                return undefined;
            }
            const completionItems = Array.isArray(completions) ? completions : completions.items ?? [];
            this._logService.trace(`TerminalCompletionService#_collectCompletions amend ${completionItems.length} completion items`);
            if (shellType === "pwsh" /* GeneralShellType.PowerShell */) {
                for (const completion of completionItems) {
                    const start = completion.replacementRange ? completion.replacementRange[0] : 0;
                    completion.isFileOverride ??= completion.kind === TerminalCompletionItemKind.Method && start === 0;
                }
            }
            if (provider.isBuiltin) {
                //TODO: why is this needed?
                for (const item of completionItems) {
                    item.provider ??= provider.id;
                }
            }
            if (Array.isArray(completions)) {
                return completionItems;
            }
            if (completions.resourceOptions) {
                const resourceCompletions = await this.resolveResources(completions.resourceOptions, promptValue, cursorPosition, `core:path:ext:${provider.id}`, capabilities, shellType);
                this._logService.trace(`TerminalCompletionService#_collectCompletions dedupe`);
                if (resourceCompletions) {
                    const labels = new Set(completionItems.map(c => c.label));
                    for (const item of resourceCompletions) {
                        // Ensure no duplicates such as .
                        if (!labels.has(item.label)) {
                            completionItems.push(item);
                        }
                    }
                }
                this._logService.trace(`TerminalCompletionService#_collectCompletions dedupe done`);
            }
            return completionItems;
        });
        const results = await Promise.all(completionPromises);
        this._logService.trace('TerminalCompletionService#_collectCompletions done');
        return results.filter(result => !!result).flat();
    }
    async resolveResources(resourceOptions, promptValue, cursorPosition, provider, capabilities, shellType) {
        this._logService.trace(`TerminalCompletionService#resolveResources`);
        const useWindowsStylePath = resourceOptions.pathSeparator === '\\';
        if (useWindowsStylePath) {
            // for tests, make sure the right path separator is used
            promptValue = promptValue.replaceAll(/[\\/]/g, resourceOptions.pathSeparator);
        }
        // Files requested implies folders requested since the file could be in any folder. We could
        // provide diagnostics when a folder is provided where a file is expected.
        const showDirectories = (resourceOptions.showDirectories || resourceOptions.showFiles) ?? false;
        const showFiles = resourceOptions.showFiles ?? false;
        const globPattern = resourceOptions.globPattern ?? undefined;
        if (!showDirectories && !showFiles) {
            return;
        }
        const resourceCompletions = [];
        const cursorPrefix = promptValue.substring(0, cursorPosition);
        // TODO: Leverage Fig's tokens array here?
        // The last word (or argument). When the cursor is following a space it will be the empty
        // string
        let lastWord = cursorPrefix.endsWith(' ') ? '' : cursorPrefix.split(/(?<!\\) /).at(-1) ?? '';
        // Ignore prefixes in the word that look like setting an environment variable
        const matchEnvVarPrefix = lastWord.match(/^[a-zA-Z_]+=(?<rhs>.+)$/);
        if (matchEnvVarPrefix?.groups?.rhs) {
            lastWord = matchEnvVarPrefix.groups.rhs;
        }
        // Get the nearest folder path from the prefix. This ignores everything after the `/` as
        // they are what triggers changes in the directory.
        let lastSlashIndex;
        if (useWindowsStylePath) {
            // TODO: Flesh out escaped path logic, it currently only partially works
            let lastBackslashIndex = -1;
            for (let i = lastWord.length - 1; i >= 0; i--) {
                if (lastWord[i] === '\\') {
                    if (i === lastWord.length - 1 || lastWord[i + 1] !== ' ') {
                        lastBackslashIndex = i;
                        break;
                    }
                }
            }
            lastSlashIndex = Math.max(lastBackslashIndex, lastWord.lastIndexOf('/'));
        }
        else {
            lastSlashIndex = lastWord.lastIndexOf(resourceOptions.pathSeparator);
        }
        // The _complete_ folder of the last word. For example if the last word is `./src/file`,
        // this will be `./src/`. This also always ends in the path separator if it is not the empty
        // string and path separators are normalized on Windows.
        let lastWordFolder = lastSlashIndex === -1 ? '' : lastWord.slice(0, lastSlashIndex + 1);
        if (useWindowsStylePath) {
            lastWordFolder = lastWordFolder.replaceAll('/', '\\');
        }
        // Determine the current folder being shown
        let lastWordFolderResource;
        const lastWordFolderHasDotPrefix = !!lastWordFolder.match(/^\.\.?[\\\/]/);
        const lastWordFolderHasTildePrefix = !!lastWordFolder.match(/^~[\\\/]?/);
        const isAbsolutePath = getIsAbsolutePath(shellType, resourceOptions.pathSeparator, lastWordFolder, useWindowsStylePath);
        const type = lastWordFolderHasTildePrefix ? 'tilde' : isAbsolutePath ? 'absolute' : 'relative';
        const cwd = URI.revive(resourceOptions.cwd);
        switch (type) {
            case 'tilde': {
                const home = this._getHomeDir(useWindowsStylePath, capabilities);
                if (home) {
                    lastWordFolderResource = URI.joinPath(URI.file(home), lastWordFolder.slice(1).replaceAll('\\ ', ' '));
                }
                if (!lastWordFolderResource) {
                    // Use less strong wording here as it's not as strong of a concept on Windows
                    // and could be misleading
                    if (lastWord.match(/^~[\\\/]$/)) {
                        lastWordFolderResource = useWindowsStylePath ? 'Home directory' : '$HOME';
                    }
                }
                break;
            }
            case 'absolute': {
                if (shellType === "gitbash" /* WindowsShellType.GitBash */) {
                    lastWordFolderResource = URI.file(gitBashToWindowsPath(lastWordFolder, this._processEnv.SystemDrive));
                }
                else {
                    lastWordFolderResource = URI.file(lastWordFolder.replaceAll('\\ ', ' '));
                }
                break;
            }
            case 'relative': {
                lastWordFolderResource = cwd;
                break;
            }
        }
        // Assemble completions based on the resource of lastWordFolder. Note that on Windows the
        // path separators are normalized to `\`.
        if (!lastWordFolderResource) {
            return undefined;
        }
        // Early exit with basic completion if we don't know the resource
        if (isString(lastWordFolderResource)) {
            resourceCompletions.push({
                label: lastWordFolder,
                provider,
                kind: TerminalCompletionItemKind.Folder,
                detail: lastWordFolderResource,
                replacementRange: [cursorPosition - lastWord.length, cursorPosition]
            });
            return resourceCompletions;
        }
        const stat = await this._fileService.resolve(lastWordFolderResource, { resolveSingleChildDescendants: true });
        if (!stat?.children) {
            return;
        }
        // Add current directory. This should be shown at the top because it will be an exact
        // match and therefore highlight the detail, plus it improves the experience when
        // runOnEnter is used.
        //
        // - (relative) `|`       -> `.`
        //   this does not have the trailing `/` intentionally as it's common to complete the
        //   current working directory and we do not want to complete `./` when `runOnEnter` is
        //   used.
        // - (relative) `./src/|` -> `./src/`
        // - (absolute) `/src/|`  -> `/src/`
        // - (tilde)    `~/|`     -> `~/`
        // - (tilde)    `~/src/|` -> `~/src/`
        this._logService.trace(`TerminalCompletionService#resolveResources cwd`);
        if (showDirectories) {
            let label;
            switch (type) {
                case 'tilde': {
                    label = lastWordFolder;
                    break;
                }
                case 'absolute': {
                    label = lastWordFolder;
                    break;
                }
                case 'relative': {
                    label = '.';
                    if (lastWordFolder.length > 0) {
                        label = addPathRelativePrefix(lastWordFolder, resourceOptions, lastWordFolderHasDotPrefix);
                    }
                    break;
                }
            }
            resourceCompletions.push({
                label,
                provider,
                kind: TerminalCompletionItemKind.Folder,
                detail: getFriendlyPath(this._labelService, lastWordFolderResource, resourceOptions.pathSeparator, TerminalCompletionItemKind.Folder, shellType),
                replacementRange: [cursorPosition - lastWord.length, cursorPosition]
            });
        }
        // Add all direct children files or folders
        //
        // - (relative) `cd ./src/`  -> `cd ./src/folder1/`, ...
        // - (absolute) `cd c:/src/` -> `cd c:/src/folder1/`, ...
        // - (tilde)    `cd ~/src/`  -> `cd ~/src/folder1/`, ...
        this._logService.trace(`TerminalCompletionService#resolveResources direct children`);
        await Promise.all(stat.children.map(child => (async () => {
            let kind;
            let detail = undefined;
            if (showDirectories && child.isDirectory) {
                if (child.isSymbolicLink) {
                    kind = TerminalCompletionItemKind.SymbolicLinkFolder;
                }
                else {
                    kind = TerminalCompletionItemKind.Folder;
                }
            }
            else if (showFiles && child.isFile) {
                if (child.isSymbolicLink) {
                    kind = TerminalCompletionItemKind.SymbolicLinkFile;
                }
                else {
                    kind = TerminalCompletionItemKind.File;
                }
            }
            if (kind === undefined) {
                return;
            }
            let label = lastWordFolder;
            if (label.length > 0 && !label.endsWith(resourceOptions.pathSeparator)) {
                label += resourceOptions.pathSeparator;
            }
            label += child.name;
            if (type === 'relative') {
                label = addPathRelativePrefix(label, resourceOptions, lastWordFolderHasDotPrefix);
            }
            if (child.isDirectory && !label.endsWith(resourceOptions.pathSeparator)) {
                label += resourceOptions.pathSeparator;
            }
            label = escapeTerminalCompletionLabel(label, shellType, resourceOptions.pathSeparator);
            if (child.isFile && globPattern) {
                const filePath = child.resource.fsPath;
                const ignoreCase = !this._fileService.hasCapability(child.resource, 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */);
                const matches = match(globPattern, filePath, { ignoreCase });
                if (!matches) {
                    return;
                }
            }
            // Try to resolve symlink target for symbolic links
            if (child.isSymbolicLink) {
                try {
                    const realpath = await this._fileService.realpath(child.resource);
                    if (realpath && !isEqual(child.resource, realpath)) {
                        detail = `${getFriendlyPath(this._labelService, child.resource, resourceOptions.pathSeparator, kind, shellType)} -> ${getFriendlyPath(this._labelService, realpath, resourceOptions.pathSeparator, kind, shellType)}`;
                    }
                }
                catch (error) {
                    // Ignore errors resolving symlink targets - they may be dangling links
                }
            }
            resourceCompletions.push({
                label,
                provider,
                kind,
                detail: detail ?? getFriendlyPath(this._labelService, child.resource, resourceOptions.pathSeparator, kind, shellType),
                replacementRange: [cursorPosition - lastWord.length, cursorPosition]
            });
        })()));
        // Support $CDPATH specially for the `cd` command only
        //
        // - (relative) `|` -> `/foo/vscode` (CDPATH has /foo which contains vscode folder)
        this._logService.trace(`TerminalCompletionService#resolveResources CDPATH`);
        if (type === 'relative' && showDirectories) {
            if (promptValue.startsWith('cd ')) {
                const config = this._configurationService.getValue("terminal.integrated.suggest.cdPath" /* TerminalSuggestSettingId.CdPath */);
                if (config === 'absolute' || config === 'relative') {
                    const cdPath = this._getEnvVar('CDPATH', capabilities);
                    if (cdPath) {
                        const cdPathEntries = cdPath.split(useWindowsStylePath ? ';' : ':');
                        for (const cdPathEntry of cdPathEntries) {
                            try {
                                const fileStat = await this._fileService.resolve(URI.file(cdPathEntry), { resolveSingleChildDescendants: true });
                                if (fileStat?.children) {
                                    for (const child of fileStat.children) {
                                        if (!child.isDirectory) {
                                            continue;
                                        }
                                        const useRelative = config === 'relative';
                                        const kind = TerminalCompletionItemKind.Folder;
                                        const label = useRelative
                                            ? basename(child.resource.fsPath)
                                            : shellType === "gitbash" /* WindowsShellType.GitBash */
                                                ? windowsToGitBashPath(child.resource.fsPath)
                                                : getFriendlyPath(this._labelService, child.resource, resourceOptions.pathSeparator, kind, shellType);
                                        const detail = useRelative
                                            ? `CDPATH ${getFriendlyPath(this._labelService, child.resource, resourceOptions.pathSeparator, kind, shellType)}`
                                            : `CDPATH`;
                                        resourceCompletions.push({
                                            label,
                                            provider,
                                            kind,
                                            detail,
                                            replacementRange: [cursorPosition - lastWord.length, cursorPosition]
                                        });
                                    }
                                }
                            }
                            catch { /* ignore */ }
                        }
                    }
                }
            }
        }
        // Add parent directory to the bottom of the list because it's not as useful as other suggestions
        //
        // - (relative) `|` -> `../`
        // - (relative) `./src/|` -> `./src/../`
        this._logService.trace(`TerminalCompletionService#resolveResources parent dir`);
        if (type === 'relative' && showDirectories) {
            let label = `..${resourceOptions.pathSeparator}`;
            if (lastWordFolder.length > 0) {
                label = addPathRelativePrefix(lastWordFolder + label, resourceOptions, lastWordFolderHasDotPrefix);
            }
            const parentDir = URI.joinPath(cwd, '..' + resourceOptions.pathSeparator);
            resourceCompletions.push({
                label,
                provider,
                kind: TerminalCompletionItemKind.Folder,
                detail: getFriendlyPath(this._labelService, parentDir, resourceOptions.pathSeparator, TerminalCompletionItemKind.Folder, shellType),
                replacementRange: [cursorPosition - lastWord.length, cursorPosition]
            });
        }
        // Add tilde for home directory for relative paths when there is no path separator in the
        // input.
        //
        // - (relative) `|` -> `~`
        this._logService.trace(`TerminalCompletionService#resolveResources tilde`);
        if (type === 'relative' && !lastWordFolder.match(/[\\\/]/)) {
            let homeResource;
            const home = this._getHomeDir(useWindowsStylePath, capabilities);
            if (home) {
                homeResource = URI.joinPath(URI.file(home), lastWordFolder.slice(1).replaceAll('\\ ', ' '));
            }
            if (!homeResource) {
                // Use less strong wording here as it's not as strong of a concept on Windows
                // and could be misleading
                homeResource = useWindowsStylePath ? 'Home directory' : '$HOME';
            }
            resourceCompletions.push({
                label: '~',
                provider,
                kind: TerminalCompletionItemKind.Folder,
                detail: isString(homeResource) ? homeResource : getFriendlyPath(this._labelService, homeResource, resourceOptions.pathSeparator, TerminalCompletionItemKind.Folder, shellType),
                replacementRange: [cursorPosition - lastWord.length, cursorPosition]
            });
        }
        this._logService.trace(`TerminalCompletionService#resolveResources done`);
        return resourceCompletions;
    }
    _getEnvVar(key, capabilities) {
        const env = capabilities.get(5 /* TerminalCapability.ShellEnvDetection */)?.env?.value;
        if (env) {
            return env[key];
        }
        return this._processEnv[key];
    }
    _getHomeDir(useWindowsStylePath, capabilities) {
        return useWindowsStylePath ? this._getEnvVar('USERPROFILE', capabilities) : this._getEnvVar('HOME', capabilities);
    }
};
TerminalCompletionService = __decorate([
    __param(0, IConfigurationService),
    __param(1, IFileService),
    __param(2, ILabelService),
    __param(3, ITerminalLogService)
], TerminalCompletionService);
export { TerminalCompletionService };
function getFriendlyPath(labelService, uri, pathSeparator, kind, shellType) {
    let path = labelService.getUriLabel(uri, { noPrefix: true });
    // Normalize line endings for folders
    const sep = shellType === "gitbash" /* WindowsShellType.GitBash */ ? '\\' : pathSeparator;
    if (kind === TerminalCompletionItemKind.Folder && !path.endsWith(sep)) {
        path += sep;
    }
    return path;
}
/**
 * Normalize suggestion to add a ./ prefix to the start of the path if there isn't one already. We
 * may want to change this behavior in the future to go with whatever format the user has.
 */
function addPathRelativePrefix(text, resourceOptions, lastWordFolderHasDotPrefix) {
    if (!lastWordFolderHasDotPrefix) {
        if (text.startsWith(resourceOptions.pathSeparator)) {
            return `.${text}`;
        }
        return `.${resourceOptions.pathSeparator}${text}`;
    }
    return text;
}
/**
 * Escapes special characters in a file/folder label for shell completion.
 * This ensures that characters like [, ], etc. are properly escaped.
 */
export function escapeTerminalCompletionLabel(label, shellType, pathSeparator) {
    // Only escape for bash/zsh/fish; PowerShell and cmd have different rules
    if (shellType === undefined || shellType === "pwsh" /* GeneralShellType.PowerShell */ || shellType === "cmd" /* WindowsShellType.CommandPrompt */) {
        return label;
    }
    return label.replace(/[\[\]\(\)'"\\\`\*\?;|&<>]/g, '\\$&');
}
function getIsAbsolutePath(shellType, pathSeparator, lastWord, useWindowsStylePath) {
    if (shellType === "gitbash" /* WindowsShellType.GitBash */) {
        return lastWord.startsWith(pathSeparator) || /^[a-zA-Z]:\//.test(lastWord);
    }
    return useWindowsStylePath ? /^[a-zA-Z]:[\\\/]/.test(lastWord) : lastWord.startsWith(pathSeparator);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21wbGV0aW9uU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3Rlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLFVBQVUsRUFBZSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDOUQsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFrQyxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM3RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sK0RBQStELENBQUM7QUFFaEcsT0FBTyxFQUFvQixtQkFBbUIsRUFBdUMsTUFBTSxxREFBcUQsQ0FBQztBQUVqSixPQUFPLEVBQUUsMEJBQTBCLEVBQTRCLE1BQU0sNkJBQTZCLENBQUM7QUFDbkcsT0FBTyxFQUFFLEdBQUcsSUFBSSxVQUFVLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUUxRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDekYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM5RSxPQUFPLEVB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