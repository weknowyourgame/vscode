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
import { equals as arraysEqual } from '../../../../base/common/arrays.js';
import { assertNever } from '../../../../base/common/assert.js';
import { decodeHex, encodeHex, VSBuffer } from '../../../../base/common/buffer.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { equals as objectsEqual } from '../../../../base/common/objects.js';
import { ObservableMap } from '../../../../base/common/observable.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { MCP } from './modelContextProtocol.js';
export const extensionMcpCollectionPrefix = 'ext.';
export function extensionPrefixedIdentifier(identifier, id) {
    return ExtensionIdentifier.toKey(identifier) + '/' + id;
}
export var McpCollectionSortOrder;
(function (McpCollectionSortOrder) {
    McpCollectionSortOrder[McpCollectionSortOrder["WorkspaceFolder"] = 0] = "WorkspaceFolder";
    McpCollectionSortOrder[McpCollectionSortOrder["Workspace"] = 100] = "Workspace";
    McpCollectionSortOrder[McpCollectionSortOrder["User"] = 200] = "User";
    McpCollectionSortOrder[McpCollectionSortOrder["Extension"] = 300] = "Extension";
    McpCollectionSortOrder[McpCollectionSortOrder["Filesystem"] = 400] = "Filesystem";
    McpCollectionSortOrder[McpCollectionSortOrder["RemoteBoost"] = -50] = "RemoteBoost";
})(McpCollectionSortOrder || (McpCollectionSortOrder = {}));
export var McpCollectionDefinition;
(function (McpCollectionDefinition) {
    function equals(a, b) {
        return a.id === b.id
            && a.remoteAuthority === b.remoteAuthority
            && a.label === b.label
            && a.trustBehavior === b.trustBehavior;
    }
    McpCollectionDefinition.equals = equals;
})(McpCollectionDefinition || (McpCollectionDefinition = {}));
export var McpServerStaticToolAvailability;
(function (McpServerStaticToolAvailability) {
    /** Tool is expected to be present as soon as the server is started. */
    McpServerStaticToolAvailability[McpServerStaticToolAvailability["Initial"] = 0] = "Initial";
    /** Tool may be present later. */
    McpServerStaticToolAvailability[McpServerStaticToolAvailability["Dynamic"] = 1] = "Dynamic";
})(McpServerStaticToolAvailability || (McpServerStaticToolAvailability = {}));
export var McpServerDefinition;
(function (McpServerDefinition) {
    function toSerialized(def) {
        return def;
    }
    McpServerDefinition.toSerialized = toSerialized;
    function fromSerialized(def) {
        return {
            id: def.id,
            label: def.label,
            cacheNonce: def.cacheNonce,
            staticMetadata: def.staticMetadata,
            launch: McpServerLaunch.fromSerialized(def.launch),
            variableReplacement: def.variableReplacement ? McpServerDefinitionVariableReplacement.fromSerialized(def.variableReplacement) : undefined,
        };
    }
    McpServerDefinition.fromSerialized = fromSerialized;
    function equals(a, b) {
        return a.id === b.id
            && a.label === b.label
            && a.cacheNonce === b.cacheNonce
            && arraysEqual(a.roots, b.roots, (a, b) => a.toString() === b.toString())
            && objectsEqual(a.launch, b.launch)
            && objectsEqual(a.presentation, b.presentation)
            && objectsEqual(a.variableReplacement, b.variableReplacement)
            && objectsEqual(a.devMode, b.devMode);
    }
    McpServerDefinition.equals = equals;
})(McpServerDefinition || (McpServerDefinition = {}));
export var McpServerDefinitionVariableReplacement;
(function (McpServerDefinitionVariableReplacement) {
    function toSerialized(def) {
        return def;
    }
    McpServerDefinitionVariableReplacement.toSerialized = toSerialized;
    function fromSerialized(def) {
        return {
            section: def.section,
            folder: def.folder ? { ...def.folder, uri: URI.revive(def.folder.uri) } : undefined,
            target: def.target,
        };
    }
    McpServerDefinitionVariableReplacement.fromSerialized = fromSerialized;
})(McpServerDefinitionVariableReplacement || (McpServerDefinitionVariableReplacement = {}));
export var IAutostartResult;
(function (IAutostartResult) {
    IAutostartResult.Empty = { working: false, starting: [], serversRequiringInteraction: [] };
})(IAutostartResult || (IAutostartResult = {}));
export var LazyCollectionState;
(function (LazyCollectionState) {
    LazyCollectionState[LazyCollectionState["HasUnknown"] = 0] = "HasUnknown";
    LazyCollectionState[LazyCollectionState["LoadingUnknown"] = 1] = "LoadingUnknown";
    LazyCollectionState[LazyCollectionState["AllKnown"] = 2] = "AllKnown";
})(LazyCollectionState || (LazyCollectionState = {}));
export const IMcpService = createDecorator('IMcpService');
export class McpStartServerInteraction {
    constructor() {
        /** @internal */
        this.participants = new ObservableMap();
    }
}
export var McpServerTrust;
(function (McpServerTrust) {
    let Kind;
    (function (Kind) {
        /** The server is trusted */
        Kind[Kind["Trusted"] = 0] = "Trusted";
        /** The server is trusted as long as its nonce matches */
        Kind[Kind["TrustedOnNonce"] = 1] = "TrustedOnNonce";
        /** The server trust was denied. */
        Kind[Kind["Untrusted"] = 2] = "Untrusted";
        /** The server is not yet trusted or untrusted. */
        Kind[Kind["Unknown"] = 3] = "Unknown";
    })(Kind = McpServerTrust.Kind || (McpServerTrust.Kind = {}));
})(McpServerTrust || (McpServerTrust = {}));
export const isMcpResourceTemplate = (obj) => {
    return obj.template !== undefined;
};
export const isMcpResource = (obj) => {
    return obj.mcpUri !== undefined;
};
export var McpServerCacheState;
(function (McpServerCacheState) {
    /** Tools have not been read before */
    McpServerCacheState[McpServerCacheState["Unknown"] = 0] = "Unknown";
    /** Tools were read from the cache */
    McpServerCacheState[McpServerCacheState["Cached"] = 1] = "Cached";
    /** Tools were read from the cache or live, but they may be outdated. */
    McpServerCacheState[McpServerCacheState["Outdated"] = 2] = "Outdated";
    /** Tools are refreshing for the first time */
    McpServerCacheState[McpServerCacheState["RefreshingFromUnknown"] = 3] = "RefreshingFromUnknown";
    /** Tools are refreshing and the current tools are cached */
    McpServerCacheState[McpServerCacheState["RefreshingFromCached"] = 4] = "RefreshingFromCached";
    /** Tool state is live, server is connected */
    McpServerCacheState[McpServerCacheState["Live"] = 5] = "Live";
})(McpServerCacheState || (McpServerCacheState = {}));
export const mcpPromptReplaceSpecialChars = (s) => s.replace(/[^a-z0-9_.-]/gi, '_');
export const mcpPromptPrefix = (definition) => `/mcp.` + mcpPromptReplaceSpecialChars(definition.label);
export var McpServerTransportType;
(function (McpServerTransportType) {
    /** A command-line MCP server communicating over standard in/out */
    McpServerTransportType[McpServerTransportType["Stdio"] = 1] = "Stdio";
    /** An MCP server that uses Server-Sent Events */
    McpServerTransportType[McpServerTransportType["HTTP"] = 2] = "HTTP";
})(McpServerTransportType || (McpServerTransportType = {}));
export var McpServerLaunch;
(function (McpServerLaunch) {
    function toSerialized(launch) {
        return launch;
    }
    McpServerLaunch.toSerialized = toSerialized;
    function fromSerialized(launch) {
        switch (launch.type) {
            case 2 /* McpServerTransportType.HTTP */:
                return { type: launch.type, uri: URI.revive(launch.uri), headers: launch.headers, authentication: launch.authentication };
            case 1 /* McpServerTransportType.Stdio */:
                return {
                    type: launch.type,
                    cwd: launch.cwd,
                    command: launch.command,
                    args: launch.args,
                    env: launch.env,
                    envFile: launch.envFile,
                };
        }
    }
    McpServerLaunch.fromSerialized = fromSerialized;
    async function hash(launch) {
        const nonce = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(launch)));
        return encodeHex(VSBuffer.wrap(new Uint8Array(nonce)));
    }
    McpServerLaunch.hash = hash;
})(McpServerLaunch || (McpServerLaunch = {}));
/**
 * McpConnectionState is the state of the underlying connection and is
 * communicated e.g. from the extension host to the renderer.
 */
export var McpConnectionState;
(function (McpConnectionState) {
    let Kind;
    (function (Kind) {
        Kind[Kind["Stopped"] = 0] = "Stopped";
        Kind[Kind["Starting"] = 1] = "Starting";
        Kind[Kind["Running"] = 2] = "Running";
        Kind[Kind["Error"] = 3] = "Error";
    })(Kind = McpConnectionState.Kind || (McpConnectionState.Kind = {}));
    McpConnectionState.toString = (s) => {
        switch (s.state) {
            case 0 /* Kind.Stopped */:
                return localize('mcpstate.stopped', 'Stopped');
            case 1 /* Kind.Starting */:
                return localize('mcpstate.starting', 'Starting');
            case 2 /* Kind.Running */:
                return localize('mcpstate.running', 'Running');
            case 3 /* Kind.Error */:
                return localize('mcpstate.error', 'Error {0}', s.message);
            default:
                assertNever(s);
        }
    };
    McpConnectionState.toKindString = (s) => {
        switch (s) {
            case 0 /* Kind.Stopped */:
                return 'stopped';
            case 1 /* Kind.Starting */:
                return 'starting';
            case 2 /* Kind.Running */:
                return 'running';
            case 3 /* Kind.Error */:
                return 'error';
            default:
                assertNever(s);
        }
    };
    /** Returns if the MCP state is one where starting a new server is valid */
    McpConnectionState.canBeStarted = (s) => s === 3 /* Kind.Error */ || s === 0 /* Kind.Stopped */;
    /** Gets whether the state is a running state. */
    McpConnectionState.isRunning = (s) => !McpConnectionState.canBeStarted(s.state);
})(McpConnectionState || (McpConnectionState = {}));
export class MpcResponseError extends Error {
    constructor(message, code, data) {
        super(`MPC ${code}: ${message}`);
        this.code = code;
        this.data = data;
    }
}
export class McpConnectionFailedError extends Error {
}
export class UserInteractionRequiredError extends Error {
    static { this.prefix = 'User interaction required: '; }
    static is(error) {
        return error.message.startsWith(this.prefix);
    }
    constructor(reason) {
        super(`${UserInteractionRequiredError.prefix}${reason}`);
        this.reason = reason;
    }
}
export var McpServerEnablementState;
(function (McpServerEnablementState) {
    McpServerEnablementState[McpServerEnablementState["Disabled"] = 0] = "Disabled";
    McpServerEnablementState[McpServerEnablementState["DisabledByAccess"] = 1] = "DisabledByAccess";
    McpServerEnablementState[McpServerEnablementState["Enabled"] = 2] = "Enabled";
})(McpServerEnablementState || (McpServerEnablementState = {}));
export var McpServerInstallState;
(function (McpServerInstallState) {
    McpServerInstallState[McpServerInstallState["Installing"] = 0] = "Installing";
    McpServerInstallState[McpServerInstallState["Installed"] = 1] = "Installed";
    McpServerInstallState[McpServerInstallState["Uninstalling"] = 2] = "Uninstalling";
    McpServerInstallState[McpServerInstallState["Uninstalled"] = 3] = "Uninstalled";
})(McpServerInstallState || (McpServerInstallState = {}));
export var McpServerEditorTab;
(function (McpServerEditorTab) {
    McpServerEditorTab["Readme"] = "readme";
    McpServerEditorTab["Manifest"] = "manifest";
    McpServerEditorTab["Configuration"] = "configuration";
})(McpServerEditorTab || (McpServerEditorTab = {}));
export const IMcpWorkbenchService = createDecorator('IMcpWorkbenchService');
let McpServerContainers = class McpServerContainers extends Disposable {
    constructor(containers, mcpWorkbenchService) {
        super();
        this.containers = containers;
        this._register(mcpWorkbenchService.onChange(this.update, this));
    }
    set mcpServer(extension) {
        this.containers.forEach(c => c.mcpServer = extension);
    }
    update(server) {
        for (const container of this.containers) {
            if (server && container.mcpServer) {
                if (server.id === container.mcpServer.id) {
                    container.mcpServer = server;
                }
            }
            else {
                container.update();
            }
        }
    }
};
McpServerContainers = __decorate([
    __param(1, IMcpWorkbenchService)
], McpServerContainers);
export { McpServerContainers };
export const McpServersGalleryStatusContext = new RawContextKey('mcpServersGalleryStatus', "unavailable" /* McpGalleryManifestStatus.Unavailable */);
export const HasInstalledMcpServersContext = new RawContextKey('hasInstalledMcpServers', true);
export const InstalledMcpServersViewId = 'workbench.views.mcp.installed';
export var McpResourceURI;
(function (McpResourceURI) {
    McpResourceURI.scheme = 'mcp-resource';
    // Random placeholder for empty authorities, otherwise they're represente as
    // `scheme//path/here` in the URI which would get normalized to `scheme/path/here`.
    const emptyAuthorityPlaceholder = 'dylo78gyp'; // chosen by a fair dice roll. Guaranteed to be random.
    function fromServer(def, resourceURI) {
        if (typeof resourceURI === 'string') {
            resourceURI = URI.parse(resourceURI);
        }
        return resourceURI.with({
            scheme: McpResourceURI.scheme,
            authority: encodeHex(VSBuffer.fromString(def.id)),
            path: ['', resourceURI.scheme, resourceURI.authority || emptyAuthorityPlaceholder].join('/') + resourceURI.path,
        });
    }
    McpResourceURI.fromServer = fromServer;
    function toServer(uri) {
        if (typeof uri === 'string') {
            uri = URI.parse(uri);
        }
        if (uri.scheme !== McpResourceURI.scheme) {
            throw new Error(`Invalid MCP resource URI: ${uri.toString()}`);
        }
        const parts = uri.path.split('/');
        if (parts.length < 3) {
            throw new Error(`Invalid MCP resource URI: ${uri.toString()}`);
        }
        const [, serverScheme, authority, ...path] = parts;
        // URI cannot correctly stringify empty authorities (#250905) so we use URL instead to construct
        const url = new URL(`${serverScheme}://${authority.toLowerCase() === emptyAuthorityPlaceholder ? '' : authority}`);
        url.pathname = path.length ? ('/' + path.join('/')) : '';
        url.search = uri.query;
        url.hash = uri.fragment;
        return {
            definitionId: decodeHex(uri.authority).toString(),
            resourceURL: url,
        };
    }
    McpResourceURI.toServer = toServer;
})(McpResourceURI || (McpResourceURI = {}));
/** Warning: this enum is cached in `mcpServer.ts` and all changes MUST only be additive. */
export var McpCapability;
(function (McpCapability) {
    McpCapability[McpCapability["Logging"] = 1] = "Logging";
    McpCapability[McpCapability["Completions"] = 2] = "Completions";
    McpCapability[McpCapability["Prompts"] = 4] = "Prompts";
    McpCapability[McpCapability["PromptsListChanged"] = 8] = "PromptsListChanged";
    McpCapability[McpCapability["Resources"] = 16] = "Resources";
    McpCapability[McpCapability["ResourcesSubscribe"] = 32] = "ResourcesSubscribe";
    McpCapability[McpCapability["ResourcesListChanged"] = 64] = "ResourcesListChanged";
    McpCapability[McpCapability["Tools"] = 128] = "Tools";
    McpCapability[McpCapability["ToolsListChanged"] = 256] = "ToolsListChanged";
})(McpCapability || (McpCapability = {}));
export const IMcpSamplingService = createDecorator('IMcpServerSampling');
export class McpError extends Error {
    static methodNotFound(method) {
        return new McpError(MCP.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
    static notAllowed() {
        return new McpError(-32000, 'The user has denied permission to call this method.');
    }
    static unknown(e) {
        const mcpError = new McpError(MCP.INTERNAL_ERROR, `Unknown error: ${e.stack}`);
        mcpError.cause = e;
        return mcpError;
    }
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.data = data;
    }
}
export var McpToolName;
(function (McpToolName) {
    McpToolName["Prefix"] = "mcp_";
    McpToolName[McpToolName["MaxPrefixLen"] = 18] = "MaxPrefixLen";
    McpToolName[McpToolName["MaxLength"] = 64] = "MaxLength";
})(McpToolName || (McpToolName = {}));
export var ElicitationKind;
(function (ElicitationKind) {
    ElicitationKind[ElicitationKind["Form"] = 0] = "Form";
    ElicitationKind[ElicitationKind["URL"] = 1] = "URL";
})(ElicitationKind || (ElicitationKind = {}));
export const IMcpElicitationService = createDecorator('IMcpElicitationService');
export const McpToolResourceLinkMimeType = 'application/vnd.code.resource-link';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwVHlwZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BUeXBlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsTUFBTSxJQUFJLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUluRixPQUFPLEVBQUUsVUFBVSxFQUFlLE1BQU0sc0NBQXNDLENBQUM7QUFDL0UsT0FBTyxFQUFFLE1BQU0sSUFBSSxZQUFZLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RSxPQUFPLEVBQWUsYUFBYSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFHbkYsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVwRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRXJGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQVU3RixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFHaEQsTUFBTSxDQUFDLE1BQU0sNEJBQTRCLEdBQUcsTUFBTSxDQUFDO0FBRW5ELE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxVQUErQixFQUFFLEVBQVU7SUFDdEYsT0FBTyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQztB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