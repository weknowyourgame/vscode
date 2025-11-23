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
import { localize } from '../../../../nls.js';
import { URI } from '../../../../base/common/uri.js';
import { Disposable, dispose } from '../../../../base/common/lifecycle.js';
import { posix, sep, win32 } from '../../../../base/common/path.js';
import { Emitter } from '../../../../base/common/event.js';
import { Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { IWorkspaceContextService, isWorkspace, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, toWorkspaceIdentifier, WORKSPACE_EXTENSION, isUntitledWorkspace, isTemporaryWorkspace } from '../../../../platform/workspace/common/workspace.js';
import { basenameOrAuthority, basename, joinPath, dirname } from '../../../../base/common/resources.js';
import { tildify, getPathLabel } from '../../../../base/common/labels.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { ExtensionsRegistry } from '../../extensions/common/extensionsRegistry.js';
import { match } from '../../../../base/common/glob.js';
import { ILifecycleService } from '../../lifecycle/common/lifecycle.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IPathService } from '../../path/common/pathService.js';
import { isProposedApiEnabled } from '../../extensions/common/extensions.js';
import { OS } from '../../../../base/common/platform.js';
import { IRemoteAgentService } from '../../remote/common/remoteAgentService.js';
import { Schemas } from '../../../../base/common/network.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { Memento } from '../../../common/memento.js';
const resourceLabelFormattersExtPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'resourceLabelFormatters',
    jsonSchema: {
        description: localize('vscode.extension.contributes.resourceLabelFormatters', 'Contributes resource label formatting rules.'),
        type: 'array',
        items: {
            type: 'object',
            required: ['scheme', 'formatting'],
            properties: {
                scheme: {
                    type: 'string',
                    description: localize('vscode.extension.contributes.resourceLabelFormatters.scheme', 'URI scheme on which to match the formatter on. For example "file". Simple glob patterns are supported.'),
                },
                authority: {
                    type: 'string',
                    description: localize('vscode.extension.contributes.resourceLabelFormatters.authority', 'URI authority on which to match the formatter on. Simple glob patterns are supported.'),
                },
                formatting: {
                    description: localize('vscode.extension.contributes.resourceLabelFormatters.formatting', "Rules for formatting uri resource labels."),
                    type: 'object',
                    properties: {
                        label: {
                            type: 'string',
                            description: localize('vscode.extension.contributes.resourceLabelFormatters.label', "Label rules to display. For example: myLabel:/${path}. ${path}, ${scheme}, ${authority} and ${authoritySuffix} are supported as variables.")
                        },
                        separator: {
                            type: 'string',
                            description: localize('vscode.extension.contributes.resourceLabelFormatters.separator', "Separator to be used in the uri label display. '/' or '\' as an example.")
                        },
                        stripPathStartingSeparator: {
                            type: 'boolean',
                            description: localize('vscode.extension.contributes.resourceLabelFormatters.stripPathStartingSeparator', "Controls whether `${path}` substitutions should have starting separator characters stripped.")
                        },
                        tildify: {
                            type: 'boolean',
                            description: localize('vscode.extension.contributes.resourceLabelFormatters.tildify', "Controls if the start of the uri label should be tildified when possible.")
                        },
                        workspaceSuffix: {
                            type: 'string',
                            description: localize('vscode.extension.contributes.resourceLabelFormatters.formatting.workspaceSuffix', "Suffix appended to the workspace label.")
                        }
                    }
                }
            }
        }
    }
});
const posixPathSeparatorRegexp = /\//g; // on Unix, backslash is a valid filename character
const winPathSeparatorRegexp = /[\\\/]/g; // on Windows, neither slash nor backslash are valid filename characters
const labelMatchingRegexp = /\$\{(scheme|authoritySuffix|authority|path|(query)\.(.+?))\}/g;
function hasDriveLetterIgnorePlatform(path) {
    return !!(path && path[2] === ':');
}
let ResourceLabelFormattersHandler = class ResourceLabelFormattersHandler {
    constructor(labelService) {
        this.formattersDisposables = new Map();
        resourceLabelFormattersExtPoint.setHandler((extensions, delta) => {
            for (const added of delta.added) {
                for (const untrustedFormatter of added.value) {
                    // We cannot trust that the formatter as it comes from an extension
                    // adheres to our interface, so for the required properties we fill
                    // in some defaults if missing.
                    const formatter = { ...untrustedFormatter };
                    if (typeof formatter.formatting.label !== 'string') {
                        formatter.formatting.label = '${authority}${path}';
                    }
                    if (typeof formatter.formatting.separator !== `string`) {
                        formatter.formatting.separator = sep;
                    }
                    if (!isProposedApiEnabled(added.description, 'contribLabelFormatterWorkspaceTooltip') && formatter.formatting.workspaceTooltip) {
                        formatter.formatting.workspaceTooltip = undefined; // workspaceTooltip is only proposed
                    }
                    this.formattersDisposables.set(formatter, labelService.registerFormatter(formatter));
                }
            }
            for (const removed of delta.removed) {
                for (const formatter of removed.value) {
                    dispose(this.formattersDisposables.get(formatter));
                }
            }
        });
    }
};
ResourceLabelFormattersHandler = __decorate([
    __param(0, ILabelService)
], ResourceLabelFormattersHandler);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ResourceLabelFormattersHandler, 3 /* LifecyclePhase.Restored */);
const FORMATTER_CACHE_SIZE = 50;
let LabelService = class LabelService extends Disposable {
    constructor(environmentService, contextService, pathService, remoteAgentService, storageService, lifecycleService) {
        super();
        this.environmentService = environmentService;
        this.contextService = contextService;
        this.pathService = pathService;
        this.remoteAgentService = remoteAgentService;
        this._onDidChangeFormatters = this._register(new Emitter({ leakWarningThreshold: 400 }));
        this.onDidChangeFormatters = this._onDidChangeFormatters.event;
        // Find some meaningful defaults until the remote environment
        // is resolved, by taking the current OS we are running in
        // and by taking the local `userHome` if we run on a local
        // file scheme.
        this.os = OS;
        this.userHome = pathService.defaultUriScheme === Schemas.file ? this.pathService.userHome({ preferLocal: true }) : undefined;
        const memento = this.storedFormattersMemento = new Memento('cachedResourceLabelFormatters2', storageService);
        this.storedFormatters = memento.getMemento(0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        this.formatters = this.storedFormatters?.formatters?.slice() || [];
        // Remote environment is potentially long running
        this.resolveRemoteEnvironment();
    }
    async resolveRemoteEnvironment() {
        // OS
        const env = await this.remoteAgentService.getEnvironment();
        this.os = env?.os ?? OS;
        // User home
        this.userHome = await this.pathService.userHome();
    }
    findFormatting(resource) {
        let bestResult;
        for (const formatter of this.formatters) {
            if (formatter.scheme === resource.scheme) {
                if (!formatter.authority && (!bestResult || formatter.priority)) {
                    bestResult = formatter;
                    continue;
                }
                if (!formatter.authority) {
                    continue;
                }
                if (match(formatter.authority, resource.authority, { ignoreCase: true }) &&
                    (!bestResult?.authority ||
                        formatter.authority.length > bestResult.authority.length ||
                        ((formatter.authority.length === bestResult.authority.length) && formatter.priority))) {
                    bestResult = formatter;
                }
            }
        }
        return bestResult ? bestResult.formatting : undefined;
    }
    getUriLabel(resource, options = {}) {
        let formatting = this.findFormatting(resource);
        if (formatting && options.separator) {
            // mixin separator if defined from the outside
            formatting = { ...formatting, separator: options.separator };
        }
        let label = this.doGetUriLabel(resource, formatting, options);
        // Without formatting we still need to support the separator
        // as provided in options (https://github.com/microsoft/vscode/issues/130019)
        if (!formatting && options.separator) {
            label = this.adjustPathSeparators(label, options.separator);
        }
        if (options.appendWorkspaceSuffix && formatting?.workspaceSuffix) {
            label = this.appendWorkspaceSuffix(label, resource);
        }
        return label;
    }
    doGetUriLabel(resource, formatting, options = {}) {
        if (!formatting) {
            return getPathLabel(resource, {
                os: this.os,
                tildify: this.userHome ? { userHome: this.userHome } : undefined,
                relative: options.relative ? {
                    noPrefix: options.noPrefix,
                    getWorkspace: () => this.contextService.getWorkspace(),
                    getWorkspaceFolder: resource => this.contextService.getWorkspaceFolder(resource)
                } : undefined
            });
        }
        // Relative label
        if (options.relative && this.contextService) {
            let folder = this.contextService.getWorkspaceFolder(resource);
            if (!folder) {
                // It is possible that the resource we want to resolve the
                // workspace folder for is not using the same scheme as
                // the folders in the workspace, so we help by trying again
                // to resolve a workspace folder by trying again with a
                // scheme that is workspace contained.
                const workspace = this.contextService.getWorkspace();
                const firstFolder = workspace.folders.at(0);
                if (firstFolder && resource.scheme !== firstFolder.uri.scheme && resource.path.startsWith(posix.sep)) {
                    folder = this.contextService.getWorkspaceFolder(firstFolder.uri.with({ path: resource.path }));
                }
            }
            if (folder) {
                const folderLabel = this.formatUri(folder.uri, formatting, options.noPrefix);
                let relativeLabel = this.formatUri(resource, formatting, options.noPrefix);
                let overlap = 0;
                while (relativeLabel[overlap] && relativeLabel[overlap] === folderLabel[overlap]) {
                    overlap++;
                }
                if (!relativeLabel[overlap] || relativeLabel[overlap] === formatting.separator) {
                    relativeLabel = relativeLabel.substring(1 + overlap);
                }
                else if (overlap === folderLabel.length && folder.uri.path === posix.sep) {
                    relativeLabel = relativeLabel.substring(overlap);
                }
                // always show root basename if there are multiple folders
                const hasMultipleRoots = this.contextService.getWorkspace().folders.length > 1;
                if (hasMultipleRoots && !options.noPrefix) {
                    const rootName = folder?.name ?? basenameOrAuthority(folder.uri);
                    relativeLabel = relativeLabel ? `${rootName} • ${relativeLabel}` : rootName;
                }
                return relativeLabel;
            }
        }
        // Absolute label
        return this.formatUri(resource, formatting, options.noPrefix);
    }
    getUriBasenameLabel(resource) {
        const formatting = this.findFormatting(resource);
        const label = this.doGetUriLabel(resource, formatting);
        let pathLib;
        if (formatting?.separator === win32.sep) {
            pathLib = win32;
        }
        else if (formatting?.separator === posix.sep) {
            pathLib = posix;
        }
        else {
            pathLib = (this.os === 1 /* OperatingSystem.Windows */) ? win32 : posix;
        }
        return pathLib.basename(label);
    }
    getWorkspaceLabel(workspace, options) {
        if (isWorkspace(workspace)) {
            const identifier = toWorkspaceIdentifier(workspace);
            if (isSingleFolderWorkspaceIdentifier(identifier) || isWorkspaceIdentifier(identifier)) {
                return this.getWorkspaceLabel(identifier, options);
            }
            return '';
        }
        // Workspace: Single Folder (as URI)
        if (URI.isUri(workspace)) {
            return this.doGetSingleFolderWorkspaceLabel(workspace, options);
        }
        // Workspace: Single Folder (as workspace identifier)
        if (isSingleFolderWorkspaceIdentifier(workspace)) {
            return this.doGetSingleFolderWorkspaceLabel(workspace.uri, options);
        }
        // Workspace: Multi Root
        if (isWorkspaceIdentifier(workspace)) {
            return this.doGetWorkspaceLabel(workspace.configPath, options);
        }
        return '';
    }
    doGetWorkspaceLabel(workspaceUri, options) {
        // Workspace: Untitled
        if (isUntitledWorkspace(workspaceUri, this.environmentService)) {
            return localize('untitledWorkspace', "Untitled (Workspace)");
        }
        // Workspace: Temporary
        if (isTemporaryWorkspace(workspaceUri)) {
            return localize('temporaryWorkspace', "Workspace");
        }
        // Workspace: Saved
        let filename = basename(workspaceUri);
        if (filename.endsWith(WORKSPACE_EXTENSION)) {
            filename = filename.substr(0, filename.length - WORKSPACE_EXTENSION.length - 1);
        }
        let label;
        switch (options?.verbose) {
            case 0 /* Verbosity.SHORT */:
                label = filename; // skip suffix for short label
                break;
            case 2 /* Verbosity.LONG */:
                label = localize('workspaceNameVerbose', "{0} (Workspace)", this.getUriLabel(joinPath(dirname(workspaceUri), filename)));
                break;
            case 1 /* Verbosity.MEDIUM */:
            default:
                label = localize('workspaceName', "{0} (Workspace)", filename);
                break;
        }
        if (options?.verbose === 0 /* Verbosity.SHORT */) {
            return label; // skip suffix for short label
        }
        return this.appendWorkspaceSuffix(label, workspaceUri);
    }
    doGetSingleFolderWorkspaceLabel(folderUri, options) {
        let label;
        switch (options?.verbose) {
            case 2 /* Verbosity.LONG */:
                label = this.getUriLabel(folderUri);
                break;
            case 0 /* Verbosity.SHORT */:
            case 1 /* Verbosity.MEDIUM */:
            default:
                label = basename(folderUri) || posix.sep;
                break;
        }
        if (options?.verbose === 0 /* Verbosity.SHORT */) {
            return label; // skip suffix for short label
        }
        return this.appendWorkspaceSuffix(label, folderUri);
    }
    getSeparator(scheme, authority) {
        const formatter = this.findFormatting(URI.from({ scheme, authority }));
        return formatter?.separator || posix.sep;
    }
    getHostLabel(scheme, authority) {
        const formatter = this.findFormatting(URI.from({ scheme, authority }));
        return formatter?.workspaceSuffix || authority || '';
    }
    getHostTooltip(scheme, authority) {
        const formatter = this.findFormatting(URI.from({ scheme, authority }));
        return formatter?.workspaceTooltip;
    }
    registerCachedFormatter(formatter) {
        const list = this.storedFormatters.formatters ??= [];
        let replace = list.findIndex(f => f.scheme === formatter.scheme && f.authority === formatter.authority);
        if (replace === -1 && list.length >= FORMATTER_CACHE_SIZE) {
            replace = FORMATTER_CACHE_SIZE - 1; // at max capacity, replace the last element
        }
        if (replace === -1) {
            list.unshift(formatter);
        }
        else {
            for (let i = replace; i > 0; i--) {
                list[i] = list[i - 1];
            }
            list[0] = formatter;
        }
        this.storedFormattersMemento.saveMemento();
        return this.registerFormatter(formatter);
    }
    registerFormatter(formatter) {
        this.formatters.push(formatter);
        this._onDidChangeFormatters.fire({ scheme: formatter.scheme });
        return {
            dispose: () => {
                this.formatters = this.formatters.filter(f => f !== formatter);
                this._onDidChangeFormatters.fire({ scheme: formatter.scheme });
            }
        };
    }
    formatUri(resource, formatting, forceNoTildify) {
        let label = formatting.label.replace(labelMatchingRegexp, (match, token, qsToken, qsValue) => {
            switch (token) {
                case 'scheme': return resource.scheme;
                case 'authority': return resource.authority;
                case 'authoritySuffix': {
                    const i = resource.authority.indexOf('+');
                    return i === -1 ? resource.authority : resource.authority.slice(i + 1);
                }
                case 'path':
                    return formatting.stripPathStartingSeparator
                        ? resource.path.slice(resource.path[0] === formatting.separator ? 1 : 0)
                        : resource.path;
                default: {
                    if (qsToken === 'query') {
                        const { query } = resource;
                        if (query && query[0] === '{' && query[query.length - 1] === '}') {
                            try {
                                return JSON.parse(query)[qsValue] || '';
                            }
                            catch { }
                        }
                    }
                    return '';
                }
            }
        });
        // convert \c:\something => C:\something
        if (formatting.normalizeDriveLetter && hasDriveLetterIgnorePlatform(label)) {
            label = label.charAt(1).toUpperCase() + label.substr(2);
        }
        if (formatting.tildify && !forceNoTildify) {
            if (this.userHome) {
                label = tildify(label, this.userHome.fsPath, this.os);
            }
        }
        if (formatting.authorityPrefix && resource.authority) {
            label = formatting.authorityPrefix + label;
        }
        return this.adjustPathSeparators(label, formatting.separator);
    }
    adjustPathSeparators(label, separator) {
        return label.replace(this.os === 1 /* OperatingSystem.Windows */ ? winPathSeparatorRegexp : posixPathSeparatorRegexp, separator);
    }
    appendWorkspaceSuffix(label, uri) {
        const formatting = this.findFormatting(uri);
        const suffix = formatting && (typeof formatting.workspaceSuffix === 'string') ? formatting.workspaceSuffix : undefined;
        return suffix ? `${label} [${suffix}]` : label;
    }
};
LabelService = __decorate([
    __param(0, IWorkbenchEnvironmentService),
    __param(1, IWorkspaceContextService),
    __param(2, IPathService),
    __param(3, IRemoteAgentService),
    __param(4, IStorageService),
    __param(5, ILifecycleService)
], LabelService);
export { LabelService };
registerSingleton(ILabelService, LabelService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiZWxTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9sYWJlbC9jb21tb24vbGFiZWxTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFlLFVBQVUsRUFBRSxPQUFPLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN4RixPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsSUFBSSxtQkFBbUIsRUFBMkQsTUFBTSxrQ0FBa0MsQ0FBQztBQUM5SSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDOUYsT0FBTyxFQUFFLHdCQUF3QixFQUFjLFdBQVcsRUFBb0MsaUNBQWlDLEVBQUUscUJBQXFCLEVBQXdCLHFCQUFxQixFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDaFUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDeEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsYUFBYSxFQUFxRixNQUFNLDRDQUE0QyxDQUFDO0FBQzlKLE9BQU8sRUFB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