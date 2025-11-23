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
import { createReadStream, promises } from 'fs';
import * as url from 'url';
import * as cookie from 'cookie';
import * as crypto from 'crypto';
import { isEqualOrParent } from '../../base/common/extpath.js';
import { getMediaMime } from '../../base/common/mime.js';
import { isLinux } from '../../base/common/platform.js';
import { ILogService, LogLevel } from '../../platform/log/common/log.js';
import { IServerEnvironmentService } from './serverEnvironmentService.js';
import { extname, dirname, join, normalize, posix, resolve } from '../../base/common/path.js';
import { FileAccess, connectionTokenCookieName, connectionTokenQueryName, Schemas, builtinExtensionsPath } from '../../base/common/network.js';
import { generateUuid } from '../../base/common/uuid.js';
import { IProductService } from '../../platform/product/common/productService.js';
import { asTextOrError, IRequestService } from '../../platform/request/common/request.js';
import { CancellationToken } from '../../base/common/cancellation.js';
import { URI } from '../../base/common/uri.js';
import { streamToBuffer } from '../../base/common/buffer.js';
import { isString } from '../../base/common/types.js';
import { ICSSDevelopmentService } from '../../platform/cssDev/node/cssDevService.js';
const textMimeType = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
};
/**
 * Return an error to the client.
 */
export async function serveError(req, res, errorCode, errorMessage) {
    res.writeHead(errorCode, { 'Content-Type': 'text/plain' });
    res.end(errorMessage);
}
export var CacheControl;
(function (CacheControl) {
    CacheControl[CacheControl["NO_CACHING"] = 0] = "NO_CACHING";
    CacheControl[CacheControl["ETAG"] = 1] = "ETAG";
    CacheControl[CacheControl["NO_EXPIRY"] = 2] = "NO_EXPIRY";
})(CacheControl || (CacheControl = {}));
/**
 * Serve a file at a given path or 404 if the file is missing.
 */
export async function serveFile(filePath, cacheControl, logService, req, res, responseHeaders) {
    try {
        const stat = await promises.stat(filePath); // throws an error if file doesn't exist
        if (cacheControl === 1 /* CacheControl.ETAG */) {
            // Check if file modified since
            const etag = `W/"${[stat.ino, stat.size, stat.mtime.getTime()].join('-')}"`; // weak validator (https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
            if (req.headers['if-none-match'] === etag) {
                res.writeHead(304);
                return void res.end();
            }
            responseHeaders['Etag'] = etag;
        }
        else if (cacheControl === 2 /* CacheControl.NO_EXPIRY */) {
            responseHeaders['Cache-Control'] = 'public, max-age=31536000';
        }
        else if (cacheControl === 0 /* CacheControl.NO_CACHING */) {
            responseHeaders['Cache-Control'] = 'no-store';
        }
        responseHeaders['Content-Type'] = textMimeType[extname(filePath)] || getMediaMime(filePath) || 'text/plain';
        res.writeHead(200, responseHeaders);
        // Data
        createReadStream(filePath).pipe(res);
    }
    catch (error) {
        if (error.code !== 'ENOENT') {
            logService.error(error);
            console.error(error.toString());
        }
        else {
            console.error(`File not found: ${filePath}`);
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return void res.end('Not found');
    }
}
const APP_ROOT = dirname(FileAccess.asFileUri('').fsPath);
const STATIC_PATH = `/static`;
const CALLBACK_PATH = `/callback`;
const WEB_EXTENSION_PATH = `/web-extension-resource`;
let WebClientServer = class WebClientServer {
    constructor(_connectionToken, _basePath, _productPath, _environmentService, _logService, _requestService, _productService, _cssDevService) {
        this._connectionToken = _connectionToken;
        this._basePath = _basePath;
        this._productPath = _productPath;
        this._environmentService = _environmentService;
        this._logService = _logService;
        this._requestService = _requestService;
        this._productService = _productService;
        this._cssDevService = _cssDevService;
        this._webExtensionResourceUrlTemplate = this._productService.extensionsGallery?.resourceUrlTemplate ? URI.parse(this._productService.extensionsGallery.resourceUrlTemplate) : undefined;
    }
    /**
     * Handle web resources (i.e. only needed by the web client).
     * **NOTE**: This method is only invoked when the server has web bits.
     * **NOTE**: This method is only invoked after the connection token has been validated.
     * @param parsedUrl The URL to handle, including base and product path
     * @param pathname The pathname of the URL, without base and product path
     */
    async handle(req, res, parsedUrl, pathname) {
        try {
            if (pathname.startsWith(STATIC_PATH) && pathname.charCodeAt(STATIC_PATH.length) === 47 /* CharCode.Slash */) {
                return this._handleStatic(req, res, pathname.substring(STATIC_PATH.length));
            }
            if (pathname === '/') {
                return this._handleRoot(req, res, parsedUrl);
            }
            if (pathname === CALLBACK_PATH) {
                // callback support
                return this._handleCallback(res);
            }
            if (pathname.startsWith(WEB_EXTENSION_PATH) && pathname.charCodeAt(WEB_EXTENSION_PATH.length) === 47 /* CharCode.Slash */) {
                // extension resource support
                return this._handleWebExtensionResource(req, res, pathname.substring(WEB_EXTENSION_PATH.length));
            }
            return serveError(req, res, 404, 'Not found.');
        }
        catch (error) {
            this._logService.error(error);
            console.error(error.toString());
            return serveError(req, res, 500, 'Internal Server Error.');
        }
    }
    /**
     * Handle HTTP requests for /static/*
     * @param resourcePath The path after /static/
     */
    async _handleStatic(req, res, resourcePath) {
        const headers = Object.create(null);
        // Strip the this._staticRoute from the path
        const normalizedPathname = decodeURIComponent(resourcePath); // support paths that are uri-encoded (e.g. spaces => %20)
        const filePath = join(APP_ROOT, normalizedPathname); // join also normalizes the path
        if (!isEqualOrParent(filePath, APP_ROOT, !isLinux)) {
            return serveError(req, res, 400, `Bad request.`);
        }
        return serveFile(filePath, this._environmentService.isBuilt ? 2 /* CacheControl.NO_EXPIRY */ : 1 /* CacheControl.ETAG */, this._logService, req, res, headers);
    }
    _getResourceURLTemplateAuthority(uri) {
        const index = uri.authority.indexOf('.');
        return index !== -1 ? uri.authority.substring(index + 1) : undefined;
    }
    /**
     * Handle extension resources
     * @param resourcePath The path after /web-extension-resource/
     */
    async _handleWebExtensionResource(req, res, resourcePath) {
        if (!this._webExtensionResourceUrlTemplate) {
            return serveError(req, res, 500, 'No extension gallery service configured.');
        }
        const normalizedPathname = decodeURIComponent(resourcePath); // support paths that are uri-encoded (e.g. spaces => %20)
        const path = normalize(normalizedPathname);
        const uri = URI.parse(path).with({
            scheme: this._webExtensionResourceUrlTemplate.scheme,
            authority: path.substring(0, path.indexOf('/')),
            path: path.substring(path.indexOf('/') + 1)
        });
        if (this._getResourceURLTemplateAuthority(this._webExtensionResourceUrlTemplate) !== this._getResourceURLTemplateAuthority(uri)) {
            return serveError(req, res, 403, 'Request Forbidden');
        }
        const headers = {};
        const setRequestHeader = (header) => {
            const value = req.headers[header];
            if (value && (isString(value) || value[0])) {
                headers[header] = isString(value) ? value : value[0];
            }
            else if (header !== header.toLowerCase()) {
                setRequestHeader(header.toLowerCase());
            }
        };
        setRequestHeader('X-Client-Name');
        setRequestHeader('X-Client-Version');
        setRequestHeader('X-Machine-Id');
        setRequestHeader('X-Client-Commit');
        const context = await this._requestService.request({
            type: 'GET',
            url: uri.toString(true),
            headers
        }, CancellationToken.None);
        const status = context.res.statusCode || 500;
        if (status !== 200) {
            let text = null;
            try {
                text = await asTextOrError(context);
            }
            catch (error) { /* Ignore */ }
            return serveError(req, res, status, text || `Request failed with status ${status}`);
        }
        const responseHeaders = Object.create(null);
        const setResponseHeader = (header) => {
            const value = context.res.headers[header];
            if (value) {
                responseHeaders[header] = value;
            }
            else if (header !== header.toLowerCase()) {
                setResponseHeader(header.toLowerCase());
            }
        };
        setResponseHeader('Cache-Control');
        setResponseHeader('Content-Type');
        res.writeHead(200, responseHeaders);
        const buffer = await streamToBuffer(context.stream);
        return void res.end(buffer.buffer);
    }
    /**
     * Handle HTTP requests for /
     */
    async _handleRoot(req, res, parsedUrl) {
        const getFirstHeader = (headerName) => {
            const val = req.headers[headerName];
            return Array.isArray(val) ? val[0] : val;
        };
        // Prefix routes with basePath for clients
        const basePath = getFirstHeader('x-forwarded-prefix') || this._basePath;
        const queryConnectionToken = parsedUrl.query[connectionTokenQueryName];
        if (typeof queryConnectionToken === 'string') {
            // We got a connection token as a query parameter.
            // We want to have a clean URL, so we strip it
            const responseHeaders = Object.create(null);
            responseHeaders['Set-Cookie'] = cookie.serialize(connectionTokenCookieName, queryConnectionToken, {
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7 /* 1 week */
            });
            const newQuery = Object.create(null);
            for (const key in parsedUrl.query) {
                if (key !== connectionTokenQueryName) {
                    newQuery[key] = parsedUrl.query[key];
                }
            }
            const newLocation = url.format({ pathname: basePath, query: newQuery });
            responseHeaders['Location'] = newLocation;
            res.writeHead(302, responseHeaders);
            return void res.end();
        }
        const replacePort = (host, port) => {
            const index = host?.indexOf(':');
            if (index !== -1) {
                host = host?.substring(0, index);
            }
            host += `:${port}`;
            return host;
        };
        const useTestResolver = (!this._environmentService.isBuilt && this._environmentService.args['use-test-resolver']);
        let remoteAuthority = (useTestResolver
            ? 'test+test'
            : (getFirstHeader('x-original-host') || getFirstHeader('x-forwarded-host') || req.headers.host));
        if (!remoteAuthority) {
            return serveError(req, res, 400, `Bad request.`);
        }
        const forwardedPort = getFirstHeader('x-forwarded-port');
        if (forwardedPort) {
            remoteAuthority = replacePort(remoteAuthority, forwardedPort);
        }
        function asJSON(value) {
            return JSON.stringify(value).replace(/"/g, '&quot;');
        }
        let _wrapWebWorkerExtHostInIframe = undefined;
        if (this._environmentService.args['enable-smoke-test-driver']) {
            // integration tests run at a time when the built output is not yet published to the CDN
            // so we must disable the iframe wrapping because the iframe URL will give a 404
            _wrapWebWorkerExtHostInIframe = false;
        }
        if (this._logService.getLevel() === LogLevel.Trace) {
            ['x-original-host', 'x-forwarded-host', 'x-forwarded-port', 'host'].forEach(header => {
                const value = getFirstHeader(header);
                if (value) {
                    this._logService.trace(`[WebClientServer] ${header}: ${value}`);
                }
            });
            this._logService.trace(`[WebClientServer] Request URL: ${req.url}, basePath: ${basePath}, remoteAuthority: ${remoteAuthority}`);
        }
        const staticRoute = posix.join(basePath, this._productPath, STATIC_PATH);
        const callbackRoute = posix.join(basePath, this._productPath, CALLBACK_PATH);
        const webExtensionRoute = posix.join(basePath, this._productPath, WEB_EXTENSION_PATH);
        const resolveWorkspaceURI = (defaultLocation) => defaultLocation && URI.file(resolve(defaultLocation)).with({ scheme: Schemas.vscodeRemote, authority: remoteAuthority });
        const filePath = FileAccess.asFileUri(`vs/code/browser/workbench/workbench${this._environmentService.isBuilt ? '' : '-dev'}.html`).fsPath;
        const authSessionInfo = !this._environmentService.isBuilt && this._environmentService.args['github-auth'] ? {
            id: generateUuid(),
            providerId: 'github',
            accessToken: this._environmentService.args['github-auth'],
            scopes: [['user:email'], ['repo']]
        } : undefined;
        const productConfiguration = {
            embedderIdentifier: 'server-distro',
            extensionsGallery: this._webExtensionResourceUrlTemplate && this._productService.extensionsGallery ? {
                ...this._productService.extensionsGallery,
                resourceUrlTemplate: this._webExtensionResourceUrlTemplate.with({
                    scheme: 'http',
                    authority: remoteAuthority,
                    path: `${webExtensionRoute}/${this._webExtensionResourceUrlTemplate.authority}${this._webExtensionResourceUrlTemplate.path}`
                }).toString(true)
            } : undefined
        };
        const proposedApi = this._environmentService.args['enable-proposed-api'];
        if (proposedApi?.length) {
            productConfiguration.extensionsEnabledWithApiProposalVersion ??= [];
            productConfiguration.extensionsEnabledWithApiProposalVersion.push(...proposedApi);
        }
        if (!this._environmentService.isBuilt) {
            try {
                const productOverrides = JSON.parse((await promises.readFile(join(APP_ROOT, 'product.overrides.json'))).toString());
                Object.assign(productConfiguration, productOverrides);
            }
            catch (err) { /* Ignore Error */ }
        }
        const workbenchWebConfiguration = {
            remoteAuthority,
            serverBasePath: basePath,
            _wrapWebWorkerExtHostInIframe,
            developmentOptions: { enableSmokeTestDriver: this._environmentService.args['enable-smoke-test-driver'] ? true : undefined, logLevel: this._logService.getLevel() },
            settingsSyncOptions: !this._environmentService.isBuilt && this._environmentService.args['enable-sync'] ? { enabled: true } : undefined,
            enableWorkspaceTrust: !this._environmentService.args['disable-workspace-trust'],
            folderUri: resolveWorkspaceURI(this._environmentService.args['default-folder']),
            workspaceUri: resolveWorkspaceURI(this._environmentService.args['default-workspace']),
            productConfiguration,
            callbackRoute: callbackRoute
        };
        const cookies = cookie.parse(req.headers.cookie || '');
        const locale = cookies['vscode.nls.locale'] || req.headers['accept-language']?.split(',')[0]?.toLowerCase() || 'en';
        let WORKBENCH_NLS_BASE_URL;
        let WORKBENCH_NLS_URL;
        if (!locale.startsWith('en') && this._productService.nlsCoreBaseUrl) {
            WORKBENCH_NLS_BASE_URL = this._productService.nlsCoreBaseUrl;
            WORKBENCH_NLS_URL = `${WORKBENCH_NLS_BASE_URL}${this._productService.commit}/${this._productService.version}/${locale}/nls.messages.js`;
        }
        else {
            WORKBENCH_NLS_URL = ''; // fallback will apply
        }
        const values = {
            WORKBENCH_WEB_CONFIGURATION: asJSON(workbenchWebConfiguration),
            WORKBENCH_AUTH_SESSION: authSessionInfo ? asJSON(authSessionInfo) : '',
            WORKBENCH_WEB_BASE_URL: staticRoute,
            WORKBENCH_NLS_URL,
            WORKBENCH_NLS_FALLBACK_URL: `${staticRoute}/out/nls.messages.js`
        };
        // DEV ---------------------------------------------------------------------------------------
        // DEV: This is for development and enables loading CSS via import-statements via import-maps.
        // DEV: The server needs to send along all CSS modules so that the client can construct the
        // DEV: import-map.
        // DEV ---------------------------------------------------------------------------------------
        if (this._cssDevService.isEnabled) {
            const cssModules = await this._cssDevService.getCssModules();
            values['WORKBENCH_DEV_CSS_MODULES'] = JSON.stringify(cssModules);
        }
        if (useTestResolver) {
            const bundledExtensions = [];
            for (const extensionPath of ['vscode-test-resolver', 'github-authentication']) {
                const packageJSON = JSON.parse((await promises.readFile(FileAccess.asFileUri(`${builtinExtensionsPath}/${extensionPath}/package.json`).fsPath)).toString());
                bundledExtensions.push({ extensionPath, packageJSON });
            }
            values['WORKBENCH_BUILTIN_EXTENSIONS'] = asJSON(bundledExtensions);
        }
        let data;
        try {
            const workbenchTemplate = (await promises.readFile(filePath)).toString();
            data = workbenchTemplate.replace(/\{\{([^}]+)\}\}/g, (_, key) => values[key] ?? 'undefined');
        }
        catch (e) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return void res.end('Not found');
        }
        const webWorkerExtensionHostIframeScriptSHA = 'sha256-2Q+j4hfT09+1+imS46J2YlkCtHWQt0/BE79PXjJ0ZJ8=';
        const cspDirectives = [
            'default-src \'self\';',
            'img-src \'self\' https: data: blob:;',
            'media-src \'self\';',
            `script-src 'self' 'unsafe-eval' ${WORKBENCH_NLS_BASE_URL ?? ''} blob: 'nonce-1nline-m4p' ${this._getScriptCspHashes(data).join(' ')} '${webWorkerExtensionHostIframeScriptSHA}' 'sha256-/r7rqQ+yrxt57sxLuQ6AMYcy/lUpvAIzHjIJt/OeLWU=' ${useTestResolver ? '' : `http://${remoteAuthority}`};`, // the sha is the same as in src/vs/workbench/services/extensions/worker/webWorkerExtensionHostIframe.html
            'child-src \'self\';',
            `frame-src 'self' https://*.vscode-cdn.net data:;`,
            'worker-src \'self\' data: blob:;',
            'style-src \'self\' \'unsafe-inline\';',
            'connect-src \'self\' ws: wss: https:;',
            'font-src \'self\' blob:;',
            'manifest-src \'self\';'
        ].join(' ');
        const headers = {
            'Content-Type': 'text/html',
            'Content-Security-Policy': cspDirectives
        };
        if (this._connectionToken.type !== 0 /* ServerConnectionTokenType.None */) {
            // At this point we know the client has a valid cookie
            // and we want to set it prolong it to ensure that this
            // client is valid for another 1 week at least
            headers['Set-Cookie'] = cookie.serialize(connectionTokenCookieName, this._connectionToken.value, {
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7 /* 1 week */
            });
        }
        res.writeHead(200, headers);
        return void res.end(data);
    }
    _getScriptCspHashes(content) {
        // Compute the CSP hashes for line scripts. Uses regex
        // which means it isn't 100% good.
        const regex = /<script>([\s\S]+?)<\/script>/img;
        const result = [];
        let match;
        while (match = regex.exec(content)) {
            const hasher = crypto.createHash('sha256');
            // This only works on Windows if we strip `\r` from `\r\n`.
            const script = match[1].replace(/\r\n/g, '\n');
            const hash = hasher
                .update(Buffer.from(script))
                .digest().toString('base64');
            result.push(`'sha256-${hash}'`);
        }
        return result;
    }
    /**
     * Handle HTTP requests for /callback
     */
    async _handleCallback(res) {
        const filePath = FileAccess.asFileUri('vs/code/browser/workbench/callback.html').fsPath;
        const data = (await promises.readFile(filePath)).toString();
        const cspDirectives = [
            'default-src \'self\';',
            'img-src \'self\' https: data: blob:;',
            'media-src \'none\';',
            `script-src 'self' ${this._getScriptCspHashes(data).join(' ')};`,
            'style-src \'self\' \'unsafe-inline\';',
            'font-src \'self\' blob:;'
        ].join(' ');
        res.writeHead(200, {
            'Content-Type': 'text/html',
            'Content-Security-Policy': cspDirectives
        });
        return void res.end(data);
    }
};
WebClientServer = __decorate([
    __param(3, IServerEnvironmentService),
    __param(4, ILogService),
    __param(5, IRequestService),
    __param(6, IProductService),
    __param(7, ICSSDevelopmentService)
], WebClientServer);
export { WebClientServer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViQ2xpZW50U2VydmVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3NlcnZlci9ub2RlL3dlYkNsaWVudFNlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBRWhELE9BQU8sS0FBSyxHQUFHLE1BQU0sS0FBSyxDQUFDO0FBQzNCLE9BQU8sS0FBSyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQ2pDLE9BQU8sS0FBSyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQ2pDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDMUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDOUYsT0FBTyxFQUFFLFVBQVUsRUFBRSx5QkFBeUIsRUFBRSx3QkFBd0IsRUFBRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvSSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDekQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRWxGLE9BQU8sRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFMUYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUU3RCxPQUFPLEVBQUUsUUFBUSxFQUFXLE1BQU0sNEJBQTRCLENBQUM7QUFHL0QsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFckYsTUFBTSxZQUFZLEdBQTBDO0lBQzNELE9BQU8sRUFBRSxXQUFXO0lBQ3BCLEtBQUssRUFBRSxpQkFBaUI7SUFDeEIsT0FBTyxFQUFFLGtCQUFrQjtJQUMzQixNQUFNLEVBQUUsVUFBVTtJQUNsQixNQUFNLEVBQUUsZUFBZTtDQUN2QixDQUFDO0FBRUY7O0dBRUc7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLFVBQVUsQ0FBQyxHQUF5QixFQUFFLEdBQXdCLEVBQUUsU0FBaUIsRUFBRSxZQUFvQjtJQUM1SCxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDO0lBQzNELEdBQUcsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUVELE1BQU0sQ0FBTixJQUFrQixZQUVqQjtBQUZELFdBQWtCLFlBQVk7SUFDN0IsMkRBQVUsQ0FBQTtJQUFFLCtDQUFJLENBQUE7SUFBRSx5REFBUyxDQUFBO0FBQzVCLENBQUMsRUFGaUIsWUFBWSxLQUFaLFlBQVksUUFFN0I7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBQyxLQUFLLFVBQVUsU0FBUyxDQUFDLFFBQWdCLEVBQUUsWUFBMEIsRUFBRSxVQUF1QixFQUFFLEdBQXlCLEVBQUUsR0FBd0IsRUFBRSxlQUF1QztJQUNsTSxJQUFJLENBQUM7UUFDSixNQUFNLElBQUksR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyx3Q0FBd0M7UUFDcEYsSUFBSSxZQUFZLDhCQUFzQixFQUFFLENBQUM7WUFFeEMsK0JBQStCO1lBQy9CLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsa0ZBQWtGO1lBQy9KLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDM0MsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkIsT0FBTyxLQUFLLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN2QixDQUFDO1lBRUQsZUFBZSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQztRQUNoQyxDQUFDO2FBQU0sSUFBSSxZQUFZLG1DQUEyQixFQUFFLENBQUM7WUFDcEQsZUFBZSxDQUFDLGVBQWUsQ0FBQyxHQUFHLDBCQUEwQixDQUFDO1FBQy9ELENBQUM7YUFBTSxJQUFJLFlBQVksb0NBQTRCLEVBQUUsQ0FBQztZQUNyRCxlQUFlLENBQUMsZUFBZSxDQUFDLEdBQUcsVUFBVSxDQUFDO1FBQy9DLENBQUM7UUFFRCxlQUFlLENBQUMsY0FBYyxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxZQUFZLENBQUM7UUFFNUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFFcEMsT0FBTztRQUNQLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNoQixJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDN0IsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN4QixPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ2pDLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUM5QyxDQUFDO1FBRUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUNyRCxPQUFPLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNsQyxDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBRTFELE1BQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQztBQUM5QixNQUFNLGFBQWEsR0FBRyxXQUFXLENBQUM7QUFDbEMsTUFBTSxrQkFBa0IsR0FBRyx5QkFBeUIsQ0FBQztBQUU5QyxJQUFNLGVBQWUsR0FBckIsTUFBTSxlQUFlO0lBSTNCLFlBQ2tCLGdCQUF1QyxFQUN2QyxTQUFpQixFQUNqQixZQUFvQixFQUNPLG1CQUE4QyxFQUM1RCxXQUF3QixFQUNwQixlQUFnQyxFQUNoQyxlQUFnQyxFQUN6QixjQUFzQztRQVA5RCxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQXVCO1FBQ3ZDLGNBQVMsR0FBVCxTQUFTLENBQVE7UUFDakIsaUJBQVksR0FBWixZQUFZLENBQVE7UUFDTyx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQTJCO1FBQzVELGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQ3BCLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQUNoQyxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDekIsbUJBQWMsR0FBZCxjQUFjLENBQXdCO1FBRS9FLElBQUksQ0FBQyxnQ0FBZ0MsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixFQUFFLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ3pMLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQXlCLEVBQUUsR0FBd0IsRUFBRSxTQUFpQyxFQUFFLFFBQWdCO1FBQ3BILElBQUksQ0FBQztZQUNKLElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsNEJBQW1CLEVBQUUsQ0FBQztnQkFDcEcsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUM3RSxDQUFDO1lBQ0QsSUFBSSxRQUFRLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQ3RCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzlDLENBQUM7WUFDRCxJQUFJLFFBQVEsS0FBSyxhQUFhLEVBQUUsQ0FBQztnQkFDaEMsbUJBQW1CO2dCQUNuQixPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbEMsQ0FBQztZQUNELElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLDRCQUFtQixFQUFFLENBQUM7Z0JBQ2xILDZCQUE2QjtnQkFDN0IsT0FBTyxJQUFJLENBQUMsMkJBQTJCLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxRQUFRLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDbEcsQ0FBQztZQUVELE9BQU8sVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzlCLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFFaEMsT0FBTyxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztRQUM1RCxDQUFDO0lBQ0YsQ0FBQztJQUNEOzs7T0FHRztJQUNLLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBeUIsRUFBRSxHQUF3QixFQUFFLFlBQW9CO1FBQ3BHLE1BQU0sT0FBTyxHQUEyQixNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTVELDRDQUE0QztRQUM1QyxNQUFNLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsMERBQTBEO1FBRXZILE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLGdDQUFnQztRQUNyRixJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ3BELE9BQU8sVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ2xELENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLGdDQUF3QixDQUFDLDBCQUFrQixFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNoSixDQUFDO0lBRU8sZ0NBQWdDLENBQUMsR0FBUTtRQUNoRCxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN6QyxPQUFPLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDdEUsQ0FBQztJQUVEOzs7T0FHRztJQUNLLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxHQUF5QixFQUFFLEdBQXdCLEVBQUUsWUFBb0I7UUFDbEgsSUFBSSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxDQUFDO1lBQzVDLE9BQU8sVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLDBDQUEwQyxDQUFDLENBQUM7UUFDOUUsQ0FBQztRQUVELE1BQU0sa0JBQWtCLEdBQUcsa0JBQWtCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQywwREFBMEQ7UUFDdkgsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDM0MsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDaEMsTUFBTSxFQUFFLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxNQUFNO1lBQ3BELFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQy9DLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzNDLENBQUMsQ0FBQztRQUVILElBQUksSUFBSSxDQUFDLGdDQUFnQyxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxLQUFLLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ2pJLE9BQU8sVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFDdkQsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFhLEVBQUUsQ0FBQztRQUM3QixNQUFNLGdCQUFnQixHQUFHLENBQUMsTUFBYyxFQUFFLEVBQUU7WUFDM0MsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNsQyxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUM1QyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0RCxDQUFDO2lCQUFNLElBQUksTUFBTSxLQUFLLE1BQU0sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO2dCQUM1QyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUN4QyxDQUFDO1FBQ0YsQ0FBQyxDQUFDO1FBQ0YsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbEMsZ0JBQWdCLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUNyQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNqQyxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRXBDLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUM7WUFDbEQsSUFBSSxFQUFFLEtBQUs7WUFDWCxHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7WUFDdkIsT0FBTztTQUNQLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFM0IsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksR0FBRyxDQUFDO1FBQzdDLElBQUksTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO1lBQ3BCLElBQUksSUFBSSxHQUFrQixJQUFJLENBQUM7WUFDL0IsSUFBSSxDQUFDO2dCQUNKLElBQUksR0FBRyxNQUFNLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNyQyxDQUFDO1lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQyxDQUFBLFlBQVksQ0FBQyxDQUFDO1lBQy9CLE9BQU8sVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLElBQUksSUFBSSw4QkFBOEIsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUNyRixDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQXNDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0UsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQWMsRUFBRSxFQUFFO1lBQzVDLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzFDLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQ1gsZUFBZSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQztZQUNqQyxDQUFDO2lCQUFNLElBQUksTUFBTSxLQUFLLE1BQU0sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO2dCQUM1QyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUN6QyxDQUFDO1FBQ0YsQ0FBQyxDQUFDO1FBQ0YsaUJBQWlCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbkMsaUJBQWlCLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDbEMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDcEMsTUFBTSxNQUFNLEdBQUcsTUFBTSxjQUFjLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BELE9BQU8sS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQXlCLEVBQUUsR0FBd0IsRUFBRSxTQUFpQztRQUUvRyxNQUFNLGNBQWMsR0FBRyxDQUFDLFVBQWtCLEVBQUUsRUFBRTtZQUM3QyxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3BDLE9BQU8sS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7UUFDMUMsQ0FBQyxDQUFDO1FBRUYsMENBQTBDO1FBQzFDLE1BQU0sUUFBUSxHQUFHLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7UUFFeEUsTUFBTSxvQkFBb0IsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDdkUsSUFBSSxPQUFPLG9CQUFvQixLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlDLGtEQUFrRDtZQUNsRCw4Q0FBOEM7WUFDOUMsTUFBTSxlQUFlLEdBQTJCLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEUsZUFBZSxDQUFDLFlBQVksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQy9DLHlCQUF5QixFQUN6QixvQkFBb0IsRUFDcEI7Z0JBQ0MsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsTUFBTSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxZQUFZO2FBQ3JDLENBQ0QsQ0FBQztZQUVGLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckMsS0FBSyxNQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ25DLElBQUksR0FBRyxLQUFLLHdCQUF3QixFQUFFLENBQUM7b0JBQ3RDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QyxDQUFDO1lBQ0YsQ0FBQztZQUNELE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3hFLGVBQWUsQ0FBQyxVQUFVLENBQUMsR0FBRyxXQUFXLENBQUM7WUFFMUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDcEMsT0FBTyxLQUFLLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN2QixDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsQ0FBQyxJQUFZLEVBQUUsSUFBWSxFQUFFLEVBQUU7WUFDbEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNqQyxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUNsQixJQUFJLEdBQUcsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDbEMsQ0FBQztZQUNELElBQUksSUFBSSxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ25CLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQyxDQUFDO1FBRUYsTUFBTSxlQUFlLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7UUFDbEgsSUFBSSxlQUFlLEdBQUcsQ0FDckIsZUFBZTtZQUNkLENBQUMsQ0FBQyxXQUFXO1lBQ2IsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLElBQUksY0FBYyxDQUFDLGtCQUFrQixDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FDaEcsQ0FBQztRQUNGLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN0QixPQUFPLFVBQVUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUNsRCxDQUFDO1FBQ0QsTUFBTSxhQUFhLEdBQUcsY0FBYyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDekQsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNuQixlQUFlLEdBQUcsV0FBVyxDQUFDLGVBQWUsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBRUQsU0FBUyxNQUFNLENBQUMsS0FBYztZQUM3QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBRUQsSUFBSSw2QkFBNkIsR0FBc0IsU0FBUyxDQUFDO1FBQ2pFLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxFQUFFLENBQUM7WUFDL0Qsd0ZBQXdGO1lBQ3hGLGdGQUFnRjtZQUNoRiw2QkFBNkIsR0FBRyxLQUFLLENBQUM7UUFDdkMsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDcEQsQ0FBQyxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3BGLE1BQU0sS0FBSyxHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDckMsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDWCxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsTUFBTSxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUM7Z0JBQ2pFLENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLGtDQUFrQyxHQUFHLENBQUMsR0FBRyxlQUFlLFFBQVEsc0JBQXNCLGVBQWUsRUFBRSxDQUFDLENBQUM7UUFDakksQ0FBQztRQUVELE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDekUsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztRQUM3RSxNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUV0RixNQUFNLG1CQUFtQixHQUFHLENBQUMsZUFBd0IsRUFBRSxFQUFFLENBQUMsZUFBZSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLGVBQWUsRUFBRSxDQUFDLENBQUM7UUFFbkwsTUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxzQ0FBc0MsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUMxSSxNQUFNLGVBQWUsR0FBRyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0csRUFBRSxFQUFFLFlBQVksRUFBRTtZQUNsQixVQUFVLEVBQUUsUUFBUTtZQUNwQixXQUFXLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDekQsTUFBTSxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ2xDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUVkLE1BQU0sb0JBQW9CLEdBQTRDO1lBQ3JFLGtCQUFrQixFQUFFLGVBQWU7WUFDbkMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGdDQUFnQyxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO2dCQUNwRyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCO2dCQUN6QyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDO29CQUMvRCxNQUFNLEVBQUUsTUFBTTtvQkFDZCxTQUFTLEVBQUUsZUFBZTtvQkFDMUIsSUFBSSxFQUFFLEdBQUcsaUJBQWlCLElBQUksSUFBSSxDQUFDLGdDQUFnQyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxFQUFFO2lCQUM1SCxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQzthQUNqQixDQUFDLENBQUMsQ0FBQyxTQUFTO1NBQ2IsQ0FBQztRQUVGLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUN6RSxJQUFJLFdBQVcsRUFBRSxNQUFNLEVBQUUsQ0FBQztZQUN6QixvQkFBb0IsQ0FBQyx1Q0FBdUMsS0FBSyxFQUFFLENBQUM7WUFDcEUsb0JBQW9CLENBQUMsdUNBQXVDLENBQUMsSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUM7UUFDbkYsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDO2dCQUNKLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7Z0JBQ3BILE1BQU0sQ0FBQyxNQUFNLENBQUMsb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUN2RCxDQUFDO1lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxDQUFBLGtCQUFrQixDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUVELE1BQU0seUJBQXlCLEdBQUc7WUFDakMsZUFBZTtZQUNmLGNBQWMsRUFBRSxRQUFRO1lBQ3hCLDZCQUE2QjtZQUM3QixrQkFBa0IsRUFBRSxFQUFFLHFCQUFxQixFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDbEssbUJBQW1CLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTO1lBQ3RJLG9CQUFvQixFQUFFLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQztZQUMvRSxTQUFTLEVBQUUsbUJBQW1CLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQy9FLFlBQVksRUFBRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDckYsb0JBQW9CO1lBQ3BCLGFBQWEsRUFBRSxhQUFhO1NBQzVCLENBQUM7UUFFRixNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsV0FBVyxFQUFFLElBQUksSUFBSSxDQUFDO1FBQ3BILElBQUksc0JBQTBDLENBQUM7UUFDL0MsSUFBSSxpQkFBeUIsQ0FBQztRQUM5QixJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3JFLHNCQUFzQixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDO1lBQzdELGlCQUFpQixHQUFHLEdBQUcsc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLElBQUksTUFBTSxrQkFBa0IsQ0FBQztRQUN6SSxDQUFDO2FBQU0sQ0FBQztZQUNQLGlCQUFpQixHQUFHLEVBQUUsQ0FBQyxDQUFDLHNCQUFzQjtRQUMvQyxDQUFDO1FBRUQsTUFBTSxNQUFNLEdBQThCO1lBQ3pDLDJCQUEyQixFQUFFLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQztZQUM5RCxzQkFBc0IsRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUN0RSxzQkFBc0IsRUFBRSxXQUFXO1lBQ25DLGlCQUFpQjtZQUNqQiwwQkFBMEIsRUFBRSxHQUFHLFdBQVcsc0JBQXNCO1NBQ2hFLENBQUM7UUFFRiw4RkFBOEY7UUFDOUYsOEZBQThGO1FBQzlGLDJGQUEyRjtRQUMzRixtQkFBbUI7UUFDbkIsOEZBQThGO1FBQzlGLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNuQyxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDN0QsTUFBTSxDQUFDLDJCQUEyQixDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNsRSxDQUFDO1FBRUQsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNyQixNQUFNLGlCQUFpQixHQUFpRSxFQUFFLENBQUM7WUFDM0YsS0FBSyxNQUFNLGFBQWEsSUFBSSxDQUFDLHNCQUFzQixFQUFFLHVCQUF1QixDQUFDLEVBQUUsQ0FBQztnQkFDL0UsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEdBQUcscUJBQXFCLElBQUksYUFBYSxlQUFlLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7Z0JBQzVKLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQ3hELENBQUM7WUFDRCxNQUFNLENBQUMsOEJBQThCLENBQUMsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNwRSxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUM7UUFDVCxJQUFJLENBQUM7WUFDSixNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDekUsSUFBSSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxXQUFXLENBQUMsQ0FBQztRQUM5RixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNaLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDckQsT0FBTyxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDbEMsQ0FBQztRQUVELE1BQU0scUNBQXFDLEdBQUcscURBQXFELENBQUM7UUFFcEcsTUFBTSxhQUFhLEdBQUc7WUFDckIsdUJBQXVCO1lBQ3ZCLHNDQUFzQztZQUN0QyxxQkFBcUI7WUFDckIsbUNBQW1DLHNCQUFzQixJQUFJLEVBQUUsNkJBQTZCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUsscUNBQXFDLDJEQUEyRCxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxlQUFlLEVBQUUsR0FBRyxFQUFHLDBHQUEwRztZQUMzWSxxQkFBcUI7WUFDckIsa0RBQWtEO1lBQ2xELGtDQUFrQztZQUNsQyx1Q0FBdUM7WUFDdkMsdUNBQXVDO1lBQ3ZDLDBCQUEwQjtZQUMxQix3QkFBd0I7U0FDeEIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFWixNQUFNLE9BQU8sR0FBNkI7WUFDekMsY0FBYyxFQUFFLFdBQVc7WUFDM0IseUJBQXlCLEVBQUUsYUFBYTtTQUN4QyxDQUFDO1FBQ0YsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSwyQ0FBbUMsRUFBRSxDQUFDO1lBQ25FLHNEQUFzRDtZQUN0RCx1REFBdUQ7WUFDdkQsOENBQThDO1lBQzlDLE9BQU8sQ0FBQyxZQUFZLENBQUMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUN2Qyx5QkFBeUIsRUFDekIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFDM0I7Z0JBQ0MsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsTUFBTSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxZQUFZO2FBQ3JDLENBQ0QsQ0FBQztRQUNILENBQUM7UUFFRCxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QixPQUFPLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMzQixDQUFDO0lBRU8sbUJBQW1CLENBQUMsT0FBZTtRQUMxQyxzREFBc0Q7UUFDdEQsa0NBQWtDO1FBQ2xDLE1BQU0sS0FBSyxHQUFHLGlDQUFpQyxDQUFDO1FBQ2hELE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztRQUM1QixJQUFJLEtBQTZCLENBQUM7UUFDbEMsT0FBTyxLQUFLLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ3BDLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDM0MsMkRBQTJEO1lBQzNELE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQy9DLE1BQU0sSUFBSSxHQUFHLE1BQU07aUJBQ2pCLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2lCQUMzQixNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFOUIsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksR0FBRyxDQUFDLENBQUM7UUFDakMsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLGVBQWUsQ0FBQyxHQUF3QjtRQUNyRCxNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLHlDQUF5QyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQ3hGLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDNUQsTUFBTSxhQUFhLEdBQUc7WUFDckIsdUJBQXVCO1lBQ3ZCLHNDQUFzQztZQUN0QyxxQkFBcUI7WUFDckIscUJBQXFCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDaEUsdUNBQXVDO1lBQ3ZDLDBCQUEwQjtTQUMxQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVaLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFO1lBQ2xCLGNBQWMsRUFBRSxXQUFXO1lBQzNCLHlCQUF5QixFQUFFLGFBQWE7U0FDeEMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0IsQ0FBQztDQUNELENBQUE7QUEvWVksZUFBZTtJQVF6QixXQUFBLHlCQUF5QixDQUFBO0lBQ3pCLFdBQUEsV0FBVyxDQUFBO0lBQ1gsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsc0JBQXNCLENBQUE7R0FaWixlQUFlLENBK1kzQiJ9