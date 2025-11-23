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
import { parse as parseUrl } from 'url';
import { Promises } from '../../../base/common/async.js';
import { streamToBufferReadableStream } from '../../../base/common/buffer.js';
import { CancellationError, getErrorMessage } from '../../../base/common/errors.js';
import { isBoolean, isNumber } from '../../../base/common/types.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { INativeEnvironmentService } from '../../environment/common/environment.js';
import { getResolvedShellEnv } from '../../shell/node/shellEnv.js';
import { ILogService } from '../../log/common/log.js';
import { AbstractRequestService, systemCertificatesNodeDefault } from '../common/request.js';
import { getProxyAgent } from './proxy.js';
import { createGunzip } from 'zlib';
/**
 * This service exposes the `request` API, while using the global
 * or configured proxy settings.
 */
let RequestService = class RequestService extends AbstractRequestService {
    constructor(machine, configurationService, environmentService, logService) {
        super(logService);
        this.machine = machine;
        this.configurationService = configurationService;
        this.environmentService = environmentService;
        this.configure();
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('http')) {
                this.configure();
            }
        }));
    }
    configure() {
        this.proxyUrl = this.getConfigValue('http.proxy');
        this.strictSSL = !!this.getConfigValue('http.proxyStrictSSL');
        this.authorization = this.getConfigValue('http.proxyAuthorization');
    }
    async request(options, token) {
        const { proxyUrl, strictSSL } = this;
        let shellEnv = undefined;
        try {
            shellEnv = await getResolvedShellEnv(this.configurationService, this.logService, this.environmentService.args, process.env);
        }
        catch (error) {
            if (!this.shellEnvErrorLogged) {
                this.shellEnvErrorLogged = true;
                this.logService.error(`resolving shell environment failed`, getErrorMessage(error));
            }
        }
        const env = {
            ...process.env,
            ...shellEnv
        };
        const agent = options.agent ? options.agent : await getProxyAgent(options.url || '', env, { proxyUrl, strictSSL });
        options.agent = agent;
        options.strictSSL = strictSSL;
        if (this.authorization) {
            options.headers = {
                ...(options.headers || {}),
                'Proxy-Authorization': this.authorization
            };
        }
        return this.logAndRequest(options, () => nodeRequest(options, token));
    }
    async resolveProxy(url) {
        return undefined; // currently not implemented in node
    }
    async lookupAuthorization(authInfo) {
        return undefined; // currently not implemented in node
    }
    async lookupKerberosAuthorization(urlStr) {
        try {
            const spnConfig = this.getConfigValue('http.proxyKerberosServicePrincipal');
            const response = await lookupKerberosAuthorization(urlStr, spnConfig, this.logService, 'RequestService#lookupKerberosAuthorization');
            return 'Negotiate ' + response;
        }
        catch (err) {
            this.logService.debug('RequestService#lookupKerberosAuthorization Kerberos authentication failed', err);
            return undefined;
        }
    }
    async loadCertificates() {
        const proxyAgent = await import('@vscode/proxy-agent');
        return proxyAgent.loadSystemCertificates({
            loadSystemCertificatesFromNode: () => this.getConfigValue('http.systemCertificatesNode', systemCertificatesNodeDefault),
            log: this.logService,
        });
    }
    getConfigValue(key, fallback) {
        if (this.machine === 'remote') {
            return this.configurationService.getValue(key);
        }
        const values = this.configurationService.inspect(key);
        return values.userLocalValue ?? values.defaultValue ?? fallback;
    }
};
RequestService = __decorate([
    __param(1, IConfigurationService),
    __param(2, INativeEnvironmentService),
    __param(3, ILogService)
], RequestService);
export { RequestService };
export async function lookupKerberosAuthorization(urlStr, spnConfig, logService, logPrefix) {
    const importKerberos = await import('kerberos');
    const kerberos = importKerberos.default || importKerberos;
    const url = new URL(urlStr);
    const spn = spnConfig
        || (process.platform === 'win32' ? `HTTP/${url.hostname}` : `HTTP@${url.hostname}`);
    logService.debug(`${logPrefix} Kerberos authentication lookup`, `proxyURL:${url}`, `spn:${spn}`);
    const client = await kerberos.initializeClient(spn);
    return client.step('');
}
async function getNodeRequest(options) {
    const endpoint = parseUrl(options.url);
    const module = endpoint.protocol === 'https:' ? await import('https') : await import('http');
    return module.request;
}
export async function nodeRequest(options, token) {
    return Promises.withAsyncBody(async (resolve, reject) => {
        const endpoint = parseUrl(options.url);
        const rawRequest = options.getRawRequest
            ? options.getRawRequest(options)
            : await getNodeRequest(options);
        const opts = {
            hostname: endpoint.hostname,
            port: endpoint.port ? parseInt(endpoint.port) : (endpoint.protocol === 'https:' ? 443 : 80),
            protocol: endpoint.protocol,
            path: endpoint.path,
            method: options.type || 'GET',
            headers: options.headers,
            agent: options.agent,
            rejectUnauthorized: isBoolean(options.strictSSL) ? options.strictSSL : true
        };
        if (options.user && options.password) {
            opts.auth = options.user + ':' + options.password;
        }
        if (options.disableCache) {
            opts.cache = 'no-store';
        }
        const req = rawRequest(opts, (res) => {
            const followRedirects = isNumber(options.followRedirects) ? options.followRedirects : 3;
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && followRedirects > 0 && res.headers['location']) {
                nodeRequest({
                    ...options,
                    url: res.headers['location'],
                    followRedirects: followRedirects - 1
                }, token).then(resolve, reject);
            }
            else {
                let stream = res;
                // Responses from Electron net module should be treated as response
                // from browser, which will apply gzip filter and decompress the response
                // using zlib before passing the result to us. Following step can be bypassed
                // in this case and proceed further.
                // Refs https://source.chromium.org/chromium/chromium/src/+/main:net/url_request/url_request_http_job.cc;l=1266-1318
                if (!options.isChromiumNetwork && res.headers['content-encoding'] === 'gzip') {
                    stream = res.pipe(createGunzip());
                }
                resolve({ res, stream: streamToBufferReadableStream(stream) });
            }
        });
        req.on('error', reject);
        // Handle timeout
        if (options.timeout) {
            // Chromium network requests do not support the `timeout` option
            if (options.isChromiumNetwork) {
                // Use Node's setTimeout for Chromium network requests
                const timeout = setTimeout(() => {
                    req.abort();
                    reject(new Error(`Request timeout after ${options.timeout}ms`));
                }, options.timeout);
                // Clear timeout when request completes
                req.on('response', () => clearTimeout(timeout));
                req.on('error', () => clearTimeout(timeout));
                req.on('abort', () => clearTimeout(timeout));
            }
            else {
                req.setTimeout(options.timeout);
            }
        }
        // Chromium will abort the request if forbidden headers are set.
        // Ref https://source.chromium.org/chromium/chromium/src/+/main:services/network/public/cpp/header_util.cc;l=14-48;
        // for additional context.
        if (options.isChromiumNetwork) {
            req.removeHeader('Content-Length');
        }
        if (options.data) {
            if (typeof options.data === 'string') {
                req.write(options.data);
            }
        }
        req.end();
        token.onCancellationRequested(() => {
            req.abort();
            reject(new CancellationError());
        });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcmVxdWVzdC9ub2RlL3JlcXVlc3RTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBSWhHLE9BQU8sRUFBRSxLQUFLLElBQUksUUFBUSxFQUFFLE1BQU0sS0FBSyxDQUFDO0FBQ3hDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN6RCxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUU5RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFcEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUVwRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNwRixPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNuRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDdEQsT0FBTyxFQUFFLHNCQUFzQixFQUEwQyw2QkFBNkIsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3JJLE9BQU8sRUFBUyxhQUFhLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDbEQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLE1BQU0sQ0FBQztBQWFwQzs7O0dBR0c7QUFDSSxJQUFNLGNBQWMsR0FBcEIsTUFBTSxjQUFlLFNBQVEsc0JBQXNCO0lBU3pELFlBQ2tCLE9BQTJCLEVBQ0osb0JBQTJDLEVBQ3ZDLGtCQUE2QyxFQUM1RSxVQUF1QjtRQUVwQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFM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