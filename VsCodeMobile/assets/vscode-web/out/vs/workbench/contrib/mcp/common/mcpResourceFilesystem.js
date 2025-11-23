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
import { sumBy } from '../../../../base/common/arrays.js';
import { disposableTimeout } from '../../../../base/common/async.js';
import { decodeBase64, VSBuffer } from '../../../../base/common/buffer.js';
import { CancellationToken, CancellationTokenPool, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { autorun } from '../../../../base/common/observable.js';
import { newWriteableStream } from '../../../../base/common/stream.js';
import { equalsIgnoreCase } from '../../../../base/common/strings.js';
import { URI } from '../../../../base/common/uri.js';
import { createFileSystemProviderError, FileSystemProviderErrorCode, FileType, IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWebContentExtractorService } from '../../../../platform/webContentExtractor/common/webContentExtractor.js';
import { McpServer } from './mcpServer.js';
import { IMcpService, McpResourceURI } from './mcpTypes.js';
import { canLoadMcpNetworkResourceDirectly } from './mcpTypesUtils.js';
const MOMENTARY_CACHE_DURATION = 3000;
let McpResourceFilesystem = class McpResourceFilesystem extends Disposable {
    get _mcpService() {
        return this._mcpServiceLazy.value;
    }
    constructor(_instantiationService, _fileService, _webContentExtractorService) {
        super();
        this._instantiationService = _instantiationService;
        this._fileService = _fileService;
        this._webContentExtractorService = _webContentExtractorService;
        /** Defer getting the MCP service since this is a BlockRestore and no need to make it unnecessarily. */
        this._mcpServiceLazy = new Lazy(() => this._instantiationService.invokeFunction(a => a.get(IMcpService)));
        /**
         * For many file operations we re-read the resources quickly (e.g. stat
         * before reading the file) and would prefer to avoid spamming the MCP
         * with multiple reads. This is a very short-duration cache
         * to solve that.
         */
        this._momentaryCache = new ResourceMap();
        this.onDidChangeCapabilities = Event.None;
        this._onDidChangeFile = this._register(new Emitter());
        this.onDidChangeFile = this._onDidChangeFile.event;
        this.capabilities = 0 /* FileSystemProviderCapabilities.None */
            | 2048 /* FileSystemProviderCapabilities.Readonly */
            | 1024 /* FileSystemProviderCapabilities.PathCaseSensitive */
            | 16 /* FileSystemProviderCapabilities.FileReadStream */
            | 16384 /* FileSystemProviderCapabilities.FileAtomicRead */
            | 2 /* FileSystemProviderCapabilities.FileReadWrite */;
        this._register(this._fileService.registerProvider(McpResourceURI.scheme, this));
    }
    //#region Filesystem API
    async readFile(resource) {
        return this._readFile(resource);
    }
    readFileStream(resource, opts, token) {
        const stream = newWriteableStream(data => VSBuffer.concat(data.map(data => VSBuffer.wrap(data))).buffer);
        this._readFile(resource, token).then(data => {
            if (opts.position) {
                data = data.slice(opts.position);
            }
            if (opts.length) {
                data = data.slice(0, opts.length);
            }
            stream.end(data);
        }, err => stream.error(err));
        return stream;
    }
    watch(uri, _opts) {
        const { resourceURI, server } = this._decodeURI(uri);
        const cap = server.capabilities.get();
        if (cap !== undefined && !(cap & 32 /* McpCapability.ResourcesSubscribe */)) {
            return Disposable.None;
        }
        server.start();
        const store = new DisposableStore();
        let watchedOnHandler;
        const watchListener = store.add(new MutableDisposable());
        const callCts = store.add(new MutableDisposable());
        store.add(autorun(reader => {
            const connection = server.connection.read(reader);
            if (!connection) {
                return;
            }
            const handler = connection.handler.read(reader);
            if (!handler || watchedOnHandler === handler) {
                return;
            }
            callCts.value?.dispose(true);
            callCts.value = new CancellationTokenSource();
            watchedOnHandler = handler;
            const token = callCts.value.token;
            handler.subscribe({ uri: resourceURI.toString() }, token).then(() => {
                if (!token.isCancellationRequested) {
                    watchListener.value = handler.onDidUpdateResource(e => {
                        if (equalsUrlPath(e.params.uri, resourceURI)) {
                            this._onDidChangeFile.fire([{ resource: uri, type: 0 /* FileChangeType.UPDATED */ }]);
                        }
                    });
                }
            }, err => {
                handler.logger.warn(`Failed to subscribe to resource changes for ${resourceURI}: ${err}`);
                watchedOnHandler = undefined;
            });
        }));
        return store;
    }
    async stat(resource) {
        const { forSameURI, contents } = await this._readURI(resource);
        if (!contents.length) {
            throw createFileSystemProviderError(`File not found`, FileSystemProviderErrorCode.FileNotFound);
        }
        return {
            ctime: 0,
            mtime: 0,
            size: sumBy(contents, c => contentToBuffer(c).byteLength),
            type: forSameURI.length ? FileType.File : FileType.Directory,
        };
    }
    async readdir(resource) {
        const { forSameURI, contents, resourceURI } = await this._readURI(resource);
        if (forSameURI.length > 0) {
            throw createFileSystemProviderError(`File is not a directory`, FileSystemProviderErrorCode.FileNotADirectory);
        }
        const resourcePathParts = resourceURI.pathname.split('/');
        const output = new Map();
        for (const content of contents) {
            const contentURI = URI.parse(content.uri);
            const contentPathParts = contentURI.path.split('/');
            // Skip contents that are not in the same directory
            if (contentPathParts.length <= resourcePathParts.length || !resourcePathParts.every((part, index) => equalsIgnoreCase(part, contentPathParts[index]))) {
                continue;
            }
            // nested resource in a directory, just emit a directory to output
            else if (contentPathParts.length > resourcePathParts.length + 1) {
                output.set(contentPathParts[resourcePathParts.length], FileType.Directory);
            }
            else {
                // resource in the same directory, emit the file
                const name = contentPathParts[contentPathParts.length - 1];
                output.set(name, contentToBuffer(content).byteLength > 0 ? FileType.File : FileType.Directory);
            }
        }
        return [...output];
    }
    mkdir(resource) {
        throw createFileSystemProviderError('write is not supported', FileSystemProviderErrorCode.NoPermissions);
    }
    writeFile(resource, content, opts) {
        throw createFileSystemProviderError('write is not supported', FileSystemProviderErrorCode.NoPermissions);
    }
    delete(resource, opts) {
        throw createFileSystemProviderError('delete is not supported', FileSystemProviderErrorCode.NoPermissions);
    }
    rename(from, to, opts) {
        throw createFileSystemProviderError('rename is not supported', FileSystemProviderErrorCode.NoPermissions);
    }
    //#endregion
    async _readFile(resource, token) {
        const { forSameURI, contents } = await this._readURI(resource);
        // MCP does not distinguish between files and directories, and says that
        // servers should just return multiple when 'reading' a directory.
        if (!forSameURI.length) {
            if (!contents.length) {
                throw createFileSystemProviderError(`File not found`, FileSystemProviderErrorCode.FileNotFound);
            }
            else {
                throw createFileSystemProviderError(`File is a directory`, FileSystemProviderErrorCode.FileIsADirectory);
            }
        }
        return contentToBuffer(forSameURI[0]);
    }
    _decodeURI(uri) {
        let definitionId;
        let resourceURL;
        try {
            ({ definitionId, resourceURL } = McpResourceURI.toServer(uri));
        }
        catch (e) {
            throw createFileSystemProviderError(String(e), FileSystemProviderErrorCode.FileNotFound);
        }
        if (resourceURL.pathname.endsWith('/')) {
            resourceURL.pathname = resourceURL.pathname.slice(0, -1);
        }
        const server = this._mcpService.servers.get().find(s => s.definition.id === definitionId);
        if (!server) {
            throw createFileSystemProviderError(`MCP server ${definitionId} not found`, FileSystemProviderErrorCode.FileNotFound);
        }
        const cap = server.capabilities.get();
        if (cap !== undefined && !(cap & 16 /* McpCapability.Resources */)) {
            throw createFileSystemProviderError(`MCP server ${definitionId} does not support resources`, FileSystemProviderErrorCode.FileNotFound);
        }
        return { definitionId, resourceURI: resourceURL, server };
    }
    async _readURI(uri, token) {
        const cached = this._momentaryCache.get(uri);
        if (cached) {
            cached.pool.add(token || CancellationToken.None);
            return cached.promise;
        }
        const pool = this._store.add(new CancellationTokenPool());
        pool.add(token || CancellationToken.None);
        const promise = this._readURIInner(uri, pool.token);
        this._momentaryCache.set(uri, { pool, promise });
        const disposable = this._store.add(disposableTimeout(() => {
            this._momentaryCache.delete(uri);
            this._store.delete(disposable);
            this._store.delete(pool);
        }, MOMENTARY_CACHE_DURATION));
        return promise;
    }
    async _readURIInner(uri, token) {
        const { resourceURI, server } = this._decodeURI(uri);
        const matchedServer = this._mcpService.servers.get().find(s => s.definition.id === server.definition.id);
        //check for http/https resources and use web content extractor service to fetch the contents.
        if (canLoadMcpNetworkResourceDirectly(resourceURI, matchedServer)) {
            const extractURI = URI.parse(resourceURI.toString());
            const result = (await this._webContentExtractorService.extract([extractURI], { followRedirects: false })).at(0);
            if (result?.status === 'ok') {
                return {
                    contents: [{ uri: resourceURI.toString(), text: result.result }],
                    resourceURI,
                    forSameURI: [{ uri: resourceURI.toString(), text: result.result }]
                };
            }
        }
        const res = await McpServer.callOn(server, r => r.readResource({ uri: resourceURI.toString() }, token), token);
        return {
            contents: res.contents,
            resourceURI,
            forSameURI: res.contents.filter(c => equalsUrlPath(c.uri, resourceURI))
        };
    }
};
McpResourceFilesystem = __decorate([
    __param(0, IInstantiationService),
    __param(1, IFileService),
    __param(2, IWebContentExtractorService)
], McpResourceFilesystem);
export { McpResourceFilesystem };
function equalsUrlPath(a, b) {
    // MCP doesn't specify either way, but underlying systems may can be case-sensitive.
    // It's better to treat case-sensitive paths as case-insensitive than vise-versa.
    return equalsIgnoreCase(new URL(a).pathname, b.pathname);
}
function contentToBuffer(content) {
    if ('text' in content) {
        return VSBuffer.fromString(content.text).buffer;
    }
    else if ('blob' in content) {
        return decodeBase64(content.blob).buffer;
    }
    else {
        throw createFileSystemProviderError('Unknown content type', FileSystemProviderErrorCode.Unknown);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwUmVzb3VyY2VGaWxlc3lzdGVtLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21jcC9jb21tb24vbWNwUmVzb3VyY2VGaWxlc3lzdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMxRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxxQkFBcUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVILE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsa0JBQWtCLEVBQXdCLE1BQU0sbUNBQW1DLENBQUM7QUFDN0YsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSw2QkFBNkIsRUFBa0QsMkJBQTJCLEVBQUUsUUFBUSxFQUFrRixZQUFZLEVBQTZMLE1BQU0sNENBQTRDLENBQUM7QUFDM2MsT0FBTyxFQUFFLHFC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