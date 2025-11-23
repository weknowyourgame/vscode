/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../base/common/uri.js';
import { LogLevel as LogServiceLevel } from '../../../platform/log/common/log.js';
import { LogLevel, createHttpPatch, createProxyResolver, createTlsPatch, createNetPatch, loadSystemCertificates } from '@vscode/proxy-agent';
import { systemCertificatesNodeDefault } from '../../../platform/request/common/request.js';
import { createRequire } from 'node:module';
import { lookupKerberosAuthorization } from '../../../platform/request/node/requestService.js';
import * as proxyAgent from '@vscode/proxy-agent';
const require = createRequire(import.meta.url);
const http = require('http');
const https = require('https');
const tls = require('tls');
const net = require('net');
const systemCertificatesV2Default = false;
const useElectronFetchDefault = false;
export function connectProxyResolver(extHostWorkspace, configProvider, extensionService, extHostLogService, mainThreadTelemetry, initData, disposables) {
    const isRemote = initData.remote.isRemote;
    const useHostProxyDefault = initData.environment.useHostProxy ?? !isRemote;
    const fallbackToLocalKerberos = useHostProxyDefault;
    const loadLocalCertificates = useHostProxyDefault;
    const isUseHostProxyEnabled = () => !isRemote || configProvider.getConfiguration('http').get('useLocalProxyConfiguration', useHostProxyDefault);
    const timedResolveProxy = createTimedResolveProxy(extHostWorkspace, mainThreadTelemetry);
    const params = {
        resolveProxy: timedResolveProxy,
        lookupProxyAuthorization: lookupProxyAuthorization.bind(undefined, extHostWorkspace, extHostLogService, mainThreadTelemetry, configProvider, {}, {}, initData.remote.isRemote, fallbackToLocalKerberos),
        getProxyURL: () => getExtHostConfigValue(configProvider, isRemote, 'http.proxy'),
        getProxySupport: () => getExtHostConfigValue(configProvider, isRemote, 'http.proxySupport') || 'off',
        getNoProxyConfig: () => getExtHostConfigValue(configProvider, isRemote, 'http.noProxy') || [],
        isAdditionalFetchSupportEnabled: () => getExtHostConfigValue(configProvider, isRemote, 'http.fetchAdditionalSupport', true),
        addCertificatesV1: () => certSettingV1(configProvider, isRemote),
        addCertificatesV2: () => certSettingV2(configProvider, isRemote),
        loadSystemCertificatesFromNode: () => getExtHostConfigValue(configProvider, isRemote, 'http.systemCertificatesNode', systemCertificatesNodeDefault),
        log: extHostLogService,
        getLogLevel: () => {
            const level = extHostLogService.getLevel();
            switch (level) {
                case LogServiceLevel.Trace: return LogLevel.Trace;
                case LogServiceLevel.Debug: return LogLevel.Debug;
                case LogServiceLevel.Info: return LogLevel.Info;
                case LogServiceLevel.Warning: return LogLevel.Warning;
                case LogServiceLevel.Error: return LogLevel.Error;
                case LogServiceLevel.Off: return LogLevel.Off;
                default: return never(level);
            }
            function never(level) {
                extHostLogService.error('Unknown log level', level);
                return LogLevel.Debug;
            }
        },
        proxyResolveTelemetry: () => { },
        isUseHostProxyEnabled,
        getNetworkInterfaceCheckInterval: () => {
            const intervalSeconds = getExtHostConfigValue(configProvider, isRemote, 'http.experimental.networkInterfaceCheckInterval', 300);
            return intervalSeconds * 1000;
        },
        loadAdditionalCertificates: async () => {
            const useNodeSystemCerts = getExtHostConfigValue(configProvider, isRemote, 'http.systemCertificatesNode', systemCertificatesNodeDefault);
            const promises = [];
            if (isRemote) {
                promises.push(loadSystemCertificates({
                    loadSystemCertificatesFromNode: () => useNodeSystemCerts,
                    log: extHostLogService,
                }));
            }
            if (loadLocalCertificates) {
                if (!isRemote && useNodeSystemCerts) {
                    promises.push(loadSystemCertificates({
                        loadSystemCertificatesFromNode: () => useNodeSystemCerts,
                        log: extHostLogService,
                    }));
                }
                else {
                    extHostLogService.trace('ProxyResolver#loadAdditionalCertificates: Loading certificates from main process');
                    const certs = extHostWorkspace.loadCertificates(); // Loading from main process to share cache.
                    certs.then(certs => extHostLogService.trace('ProxyResolver#loadAdditionalCertificates: Loaded certificates from main process', certs.length));
                    promises.push(certs);
                }
            }
            // Using https.globalAgent because it is shared with proxy.test.ts and mutable.
            if (initData.environment.extensionTestsLocationURI && https.globalAgent.testCertificates?.length) {
                extHostLogService.trace('ProxyResolver#loadAdditionalCertificates: Loading test certificates');
                promises.push(Promise.resolve(https.globalAgent.testCertificates));
            }
            return (await Promise.all(promises)).flat();
        },
        env: process.env,
    };
    const { resolveProxyWithRequest, resolveProxyURL } = createProxyResolver(params);
    // eslint-disable-next-line local/code-no-any-casts
    const target = proxyAgent.default || proxyAgent;
    target.resolveProxyURL = resolveProxyURL;
    patchGlobalFetch(params, configProvider, mainThreadTelemetry, initData, resolveProxyURL, disposables);
    const lookup = createPatchedModules(params, resolveProxyWithRequest);
    return configureModuleLoading(extensionService, lookup);
}
const unsafeHeaders = [
    'content-length',
    'host',
    'trailer',
    'te',
    'upgrade',
    'cookie2',
    'keep-alive',
    'transfer-encoding',
    'set-cookie',
];
function patchGlobalFetch(params, configProvider, mainThreadTelemetry, initData, resolveProxyURL, disposables) {
    // eslint-disable-next-line local/code-no-any-casts
    if (!globalThis.__vscodeOriginalFetch) {
        const originalFetch = globalThis.fetch;
        // eslint-disable-next-line local/code-no-any-casts
        globalThis.__vscodeOriginalFetch = originalFetch;
        const patchedFetch = proxyAgent.createFetchPatch(params, originalFetch, resolveProxyURL);
        // eslint-disable-next-line local/code-no-any-casts
        globalThis.__vscodePatchedFetch = patchedFetch;
        let useElectronFetch = false;
        if (!initData.remote.isRemote) {
            useElectronFetch = configProvider.getConfiguration('http').get('electronFetch', useElectronFetchDefault);
            disposables.add(configProvider.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('http.electronFetch')) {
                    useElectronFetch = configProvider.getConfiguration('http').get('electronFetch', useElectronFetchDefault);
                }
            }));
        }
        // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
        globalThis.fetch = async function fetch(input, init) {
            function getRequestProperty(name) {
                return init && name in init ? init[name] : typeof input === 'object' && 'cache' in input ? input[name] : undefined;
            }
            // Limitations: https://github.com/electron/electron/pull/36733#issuecomment-1405615494
            // net.fetch fails on manual redirect: https://github.com/electron/electron/issues/43715
            const urlString = typeof input === 'string' ? input : 'cache' in input ? input.url : input.toString();
            const isDataUrl = urlString.startsWith('data:');
            if (isDataUrl) {
                recordFetchFeatureUse(mainThreadTelemetry, 'data');
            }
            const isBlobUrl = urlString.startsWith('blob:');
            if (isBlobUrl) {
                recordFetchFeatureUse(mainThreadTelemetry, 'blob');
            }
            const isManualRedirect = getRequestProperty('redirect') === 'manual';
            if (isManualRedirect) {
                recordFetchFeatureUse(mainThreadTelemetry, 'manualRedirect');
            }
            const integrity = getRequestProperty('integrity');
            if (integrity) {
                recordFetchFeatureUse(mainThreadTelemetry, 'integrity');
            }
            if (!useElectronFetch || isDataUrl || isBlobUrl || isManualRedirect || integrity) {
                const response = await patchedFetch(input, init);
                monitorResponseProperties(mainThreadTelemetry, response, urlString);
                return response;
            }
            // Unsupported headers: https://source.chromium.org/chromium/chromium/src/+/main:services/network/public/cpp/header_util.cc;l=32;drc=ee7299f8961a1b05a3554efcc496b6daa0d7f6e1
            if (init?.headers) {
                const headers = new Headers(init.headers);
                for (const header of unsafeHeaders) {
                    headers.delete(header);
                }
                init = { ...init, headers };
            }
            // Support for URL: https://github.com/electron/electron/issues/43712
            const electronInput = input instanceof URL ? input.toString() : input;
            const electron = require('electron');
            const response = await electron.net.fetch(electronInput, init);
            monitorResponseProperties(mainThreadTelemetry, response, urlString);
            return response;
        };
    }
}
function monitorResponseProperties(mainThreadTelemetry, response, urlString) {
    const originalUrl = response.url;
    Object.defineProperty(response, 'url', {
        get() {
            recordFetchFeatureUse(mainThreadTelemetry, 'url');
            return originalUrl || urlString;
        }
    });
    const originalType = response.type;
    Object.defineProperty(response, 'type', {
        get() {
            recordFetchFeatureUse(mainThreadTelemetry, 'typeProperty');
            return originalType !== 'default' ? originalType : 'basic';
        }
    });
}
const fetchFeatureUse = {
    url: 0,
    typeProperty: 0,
    data: 0,
    blob: 0,
    integrity: 0,
    manualRedirect: 0,
};
let timer;
const enableFeatureUseTelemetry = false;
function recordFetchFeatureUse(mainThreadTelemetry, feature) {
    if (enableFeatureUseTelemetry && !fetchFeatureUse[feature]++) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            mainThreadTelemetry.$publicLog2('fetchFeatureUse', fetchFeatureUse);
        }, 10000); // collect additional features for 10 seconds
        timer.unref?.();
    }
}
const proxyResolveStats = {
    count: 0,
    totalDuration: 0,
    minDuration: Number.MAX_SAFE_INTEGER,
    maxDuration: 0,
    lastSentTime: 0,
};
const telemetryInterval = 60 * 60 * 1000; // 1 hour
function sendProxyResolveStats(mainThreadTelemetry) {
    if (proxyResolveStats.count > 0) {
        const avgDuration = proxyResolveStats.totalDuration / proxyResolveStats.count;
        mainThreadTelemetry.$publicLog2('proxyResolveStats', {
            count: proxyResolveStats.count,
            totalDuration: proxyResolveStats.totalDuration,
            minDuration: proxyResolveStats.minDuration,
            maxDuration: proxyResolveStats.maxDuration,
            avgDuration,
        });
        // Reset stats after sending
        proxyResolveStats.count = 0;
        proxyResolveStats.totalDuration = 0;
        proxyResolveStats.minDuration = Number.MAX_SAFE_INTEGER;
        proxyResolveStats.maxDuration = 0;
    }
    proxyResolveStats.lastSentTime = Date.now();
}
function createTimedResolveProxy(extHostWorkspace, mainThreadTelemetry) {
    return async (url) => {
        const startTime = performance.now();
        try {
            return await extHostWorkspace.resolveProxy(url);
        }
        finally {
            const duration = performance.now() - startTime;
            proxyResolveStats.count++;
            proxyResolveStats.totalDuration += duration;
            proxyResolveStats.minDuration = Math.min(proxyResolveStats.minDuration, duration);
            proxyResolveStats.maxDuration = Math.max(proxyResolveStats.maxDuration, duration);
            // Send telemetry if at least an hour has passed since last send
            const now = Date.now();
            if (now - proxyResolveStats.lastSentTime >= telemetryInterval) {
                sendProxyResolveStats(mainThreadTelemetry);
            }
        }
    };
}
function createPatchedModules(params, resolveProxy) {
    function mergeModules(module, patch) {
        const target = module.default || module;
        target.__vscodeOriginal = Object.assign({}, target);
        return Object.assign(target, patch);
    }
    return {
        http: mergeModules(http, createHttpPatch(params, http, resolveProxy)),
        https: mergeModules(https, createHttpPatch(params, https, resolveProxy)),
        net: mergeModules(net, createNetPatch(params, net)),
        tls: mergeModules(tls, createTlsPatch(params, tls))
    };
}
function certSettingV1(configProvider, isRemote) {
    return !getExtHostConfigValue(configProvider, isRemote, 'http.experimental.systemCertificatesV2', systemCertificatesV2Default) && !!getExtHostConfigValue(configProvider, isRemote, 'http.systemCertificates');
}
function certSettingV2(configProvider, isRemote) {
    return !!getExtHostConfigValue(configProvider, isRemote, 'http.experimental.systemCertificatesV2', systemCertificatesV2Default) && !!getExtHostConfigValue(configProvider, isRemote, 'http.systemCertificates');
}
const modulesCache = new Map();
function configureModuleLoading(extensionService, lookup) {
    return extensionService.getExtensionPathIndex()
        .then(extensionPaths => {
        const node_module = require('module');
        const original = node_module._load;
        node_module._load = function load(request, parent, isMain) {
            if (request === 'net') {
                return lookup.net;
            }
            if (request === 'tls') {
                return lookup.tls;
            }
            if (request !== 'http' && request !== 'https' && request !== 'undici') {
                return original.apply(this, arguments);
            }
            const ext = extensionPaths.findSubstr(URI.file(parent.filename));
            let cache = modulesCache.get(ext);
            if (!cache) {
                modulesCache.set(ext, cache = {});
            }
            if (!cache[request]) {
                if (request === 'undici') {
                    const undici = original.apply(this, arguments);
                    proxyAgent.patchUndici(undici);
                    cache[request] = undici;
                }
                else {
                    const mod = lookup[request];
                    cache[request] = { ...mod }; // Copy to work around #93167.
                }
            }
            return cache[request];
        };
    });
}
async function lookupProxyAuthorization(extHostWorkspace, extHostLogService, mainThreadTelemetry, configProvider, proxyAuthenticateCache, basicAuthCache, isRemote, fallbackToLocalKerberos, proxyURL, proxyAuthenticate, state) {
    const cached = proxyAuthenticateCache[proxyURL];
    if (proxyAuthenticate) {
        proxyAuthenticateCache[proxyURL] = proxyAuthenticate;
    }
    extHostLogService.trace('ProxyResolver#lookupProxyAuthorization callback', `proxyURL:${proxyURL}`, `proxyAuthenticate:${proxyAuthenticate}`, `proxyAuthenticateCache:${cached}`);
    const header = proxyAuthenticate || cached;
    const authenticate = Array.isArray(header) ? header : typeof header === 'string' ? [header] : [];
    sendTelemetry(mainThreadTelemetry, authenticate, isRemote);
    if (authenticate.some(a => /^(Negotiate|Kerberos)( |$)/i.test(a)) && !state.kerberosRequested) {
        state.kerberosRequested = true;
        try {
            const spnConfig = getExtHostConfigValue(configProvider, isRemote, 'http.proxyKerberosServicePrincipal');
            const response = await lookupKerberosAuthorization(proxyURL, spnConfig, extHostLogService, 'ProxyResolver#lookupProxyAuthorization');
            return 'Negotiate ' + response;
        }
        catch (err) {
            extHostLogService.debug('ProxyResolver#lookupProxyAuthorization Kerberos authentication failed', err);
        }
        if (isRemote && fallbackToLocalKerberos) {
            extHostLogService.debug('ProxyResolver#lookupProxyAuthorization Kerberos authentication lookup on host', `proxyURL:${proxyURL}`);
            const auth = await extHostWorkspace.lookupKerberosAuthorization(proxyURL);
            if (auth) {
                return 'Negotiate ' + auth;
            }
        }
    }
    const basicAuthHeader = authenticate.find(a => /^Basic( |$)/i.test(a));
    if (basicAuthHeader) {
        try {
            const cachedAuth = basicAuthCache[proxyURL];
            if (cachedAuth) {
                if (state.basicAuthCacheUsed) {
                    extHostLogService.debug('ProxyResolver#lookupProxyAuthorization Basic authentication deleting cached credentials', `proxyURL:${proxyURL}`);
                    delete basicAuthCache[proxyURL];
                }
                else {
                    extHostLogService.debug('ProxyResolver#lookupProxyAuthorization Basic authentication using cached credentials', `proxyURL:${proxyURL}`);
                    state.basicAuthCacheUsed = true;
                    return cachedAuth;
                }
            }
            state.basicAuthAttempt = (state.basicAuthAttempt || 0) + 1;
            const realm = / realm="([^"]+)"/i.exec(basicAuthHeader)?.[1];
            extHostLogService.debug('ProxyResolver#lookupProxyAuthorization Basic authentication lookup', `proxyURL:${proxyURL}`, `realm:${realm}`);
            const url = new URL(proxyURL);
            const authInfo = {
                scheme: 'basic',
                host: url.hostname,
                port: Number(url.port),
                realm: realm || '',
                isProxy: true,
                attempt: state.basicAuthAttempt,
            };
            const credentials = await extHostWorkspace.lookupAuthorization(authInfo);
            if (credentials) {
                extHostLogService.debug('ProxyResolver#lookupProxyAuthorization Basic authentication received credentials', `proxyURL:${proxyURL}`, `realm:${realm}`);
                const auth = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
                basicAuthCache[proxyURL] = auth;
                return auth;
            }
            else {
                extHostLogService.debug('ProxyResolver#lookupProxyAuthorization Basic authentication received no credentials', `proxyURL:${proxyURL}`, `realm:${realm}`);
            }
        }
        catch (err) {
            extHostLogService.error('ProxyResolver#lookupProxyAuthorization Basic authentication failed', err);
        }
    }
    return undefined;
}
let telemetrySent = false;
const enableProxyAuthenticationTelemetry = false;
function sendTelemetry(mainThreadTelemetry, authenticate, isRemote) {
    if (!enableProxyAuthenticationTelemetry || telemetrySent || !authenticate.length) {
        return;
    }
    telemetrySent = true;
    mainThreadTelemetry.$publicLog2('proxyAuthenticationRequest', {
        authenticationType: authenticate.map(a => a.split(' ')[0]).join(','),
        extensionHostType: isRemote ? 'remote' : 'local',
    });
}
function getExtHostConfigValue(configProvider, isRemote, key, fallback) {
    if (isRemote) {
        return configProvider.getConfiguration().get(key) ?? fallback;
    }
    const values = configProvider.getConfiguration().inspect(key);
    return values?.globalLocalValue ?? values?.defaultValue ?? fallback;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJveHlSZXNvbHZlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL25vZGUvcHJveHlSZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQU9oRyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFlLFFBQVEsSUFBSSxlQUFlLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUvRixPQUFPLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxjQUFjLEVBQXlDLGNBQWMsRUFBRSxzQkFBc0IsRUFBMkIsTUFBTSxxQkFBcUIsQ0FBQztBQUM3TSxPQUFPLEVBQVksNkJBQTZCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUV0RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBRzVDLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQy9GLE9BQU8sS0FBSyxVQUFVLE1BQU0scUJBQXFCLENBQUM7QUFFbEQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDL0MsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzdCLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMvQixNQUFNLEdBQUcsR0FBbUIsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzNDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUUzQixNQUFNLDJCQUEyQixHQUFHLEtBQUssQ0FBQztBQUMxQyxNQUFNLHVCQUF1QixHQUFHLEtBQUssQ0FBQztBQUV0QyxNQUFNLFVBQVUsb0JBQW9CLENBQ25DLGdCQUEyQyxFQUMzQyxj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