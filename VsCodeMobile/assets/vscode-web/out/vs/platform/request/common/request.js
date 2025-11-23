/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { streamToBuffer } from '../../../base/common/buffer.js';
import { getErrorMessage } from '../../../base/common/errors.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { localize } from '../../../nls.js';
import { Extensions } from '../../configuration/common/configurationRegistry.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { Registry } from '../../registry/common/platform.js';
export const IRequestService = createDecorator('requestService');
class LoggableHeaders {
    constructor(original) {
        this.original = original;
    }
    toJSON() {
        if (!this.headers) {
            const headers = Object.create(null);
            for (const key in this.original) {
                if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'proxy-authorization') {
                    headers[key] = '*****';
                }
                else {
                    headers[key] = this.original[key];
                }
            }
            this.headers = headers;
        }
        return this.headers;
    }
}
export class AbstractRequestService extends Disposable {
    constructor(logService) {
        super();
        this.logService = logService;
        this.counter = 0;
    }
    async logAndRequest(options, request) {
        const prefix = `#${++this.counter}: ${options.url}`;
        this.logService.trace(`${prefix} - begin`, options.type, new LoggableHeaders(options.headers ?? {}));
        try {
            const result = await request();
            this.logService.trace(`${prefix} - end`, options.type, result.res.statusCode, result.res.headers);
            return result;
        }
        catch (error) {
            this.logService.error(`${prefix} - error`, options.type, getErrorMessage(error));
            throw error;
        }
    }
}
export function isSuccess(context) {
    return (context.res.statusCode && context.res.statusCode >= 200 && context.res.statusCode < 300) || context.res.statusCode === 1223;
}
export function isClientError(context) {
    return !!context.res.statusCode && context.res.statusCode >= 400 && context.res.statusCode < 500;
}
export function isServerError(context) {
    return !!context.res.statusCode && context.res.statusCode >= 500 && context.res.statusCode < 600;
}
export function hasNoContent(context) {
    return context.res.statusCode === 204;
}
export async function asText(context) {
    if (hasNoContent(context)) {
        return null;
    }
    const buffer = await streamToBuffer(context.stream);
    return buffer.toString();
}
export async function asTextOrError(context) {
    if (!isSuccess(context)) {
        throw new Error('Server returned ' + context.res.statusCode);
    }
    return asText(context);
}
export async function asJson(context) {
    if (!isSuccess(context)) {
        throw new Error('Server returned ' + context.res.statusCode);
    }
    if (hasNoContent(context)) {
        return null;
    }
    const buffer = await streamToBuffer(context.stream);
    const str = buffer.toString();
    try {
        return JSON.parse(str);
    }
    catch (err) {
        err.message += ':\n' + str;
        throw err;
    }
}
export function updateProxyConfigurationsScope(useHostProxy, useHostProxyDefault) {
    registerProxyConfigurations(useHostProxy, useHostProxyDefault);
}
export const USER_LOCAL_AND_REMOTE_SETTINGS = [
    'http.proxy',
    'http.proxyStrictSSL',
    'http.proxyKerberosServicePrincipal',
    'http.noProxy',
    'http.proxyAuthorization',
    'http.proxySupport',
    'http.systemCertificates',
    'http.systemCertificatesNode',
    'http.experimental.systemCertificatesV2',
    'http.fetchAdditionalSupport',
    'http.experimental.networkInterfaceCheckInterval',
];
export const systemCertificatesNodeDefault = false;
let proxyConfiguration = [];
let previousUseHostProxy = undefined;
let previousUseHostProxyDefault = undefined;
function registerProxyConfigurations(useHostProxy = true, useHostProxyDefault = true) {
    if (previousUseHostProxy === useHostProxy && previousUseHostProxyDefault === useHostProxyDefault) {
        return;
    }
    previousUseHostProxy = useHostProxy;
    previousUseHostProxyDefault = useHostProxyDefault;
    const configurationRegistry = Registry.as(Extensions.Configuration);
    const oldProxyConfiguration = proxyConfiguration;
    proxyConfiguration = [
        {
            id: 'http',
            order: 15,
            title: localize('httpConfigurationTitle', "HTTP"),
            type: 'object',
            scope: 2 /* ConfigurationScope.MACHINE */,
            properties: {
                'http.useLocalProxyConfiguration': {
                    type: 'boolean',
                    default: useHostProxyDefault,
                    markdownDescription: localize('useLocalProxy', "Controls whether in the remote extension host the local proxy configuration should be used. This setting only applies as a remote setting during [remote development](https://aka.ms/vscode-remote)."),
                    restricted: true
                },
            }
        },
        {
            id: 'http',
            order: 15,
            title: localize('httpConfigurationTitle', "HTTP"),
            type: 'object',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            properties: {
                'http.electronFetch': {
                    type: 'boolean',
                    default: false,
                    description: localize('electronFetch', "Controls whether use of Electron's fetch implementation instead of Node.js' should be enabled. All local extensions will get Electron's fetch implementation for the global fetch API."),
                    restricted: true
                },
            }
        },
        {
            id: 'http',
            order: 15,
            title: localize('httpConfigurationTitle', "HTTP"),
            type: 'object',
            scope: useHostProxy ? 1 /* ConfigurationScope.APPLICATION */ : 2 /* ConfigurationScope.MACHINE */,
            properties: {
                'http.proxy': {
                    type: 'string',
                    pattern: '^(https?|socks|socks4a?|socks5h?)://([^:]*(:[^@]*)?@)?([^:]+|\\[[:0-9a-fA-F]+\\])(:\\d+)?/?$|^$',
                    markdownDescription: localize('proxy', "The proxy setting to use. If not set, will be inherited from the `http_proxy` and `https_proxy` environment variables. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true
                },
                'http.proxyStrictSSL': {
                    type: 'boolean',
                    default: true,
                    markdownDescription: localize('strictSSL', "Controls whether the proxy server certificate should be verified against the list of supplied CAs. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true
                },
                'http.proxyKerberosServicePrincipal': {
                    type: 'string',
                    markdownDescription: localize('proxyKerberosServicePrincipal', "Overrides the principal service name for Kerberos authentication with the HTTP proxy. A default based on the proxy hostname is used when this is not set. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true
                },
                'http.noProxy': {
                    type: 'array',
                    items: { type: 'string' },
                    markdownDescription: localize('noProxy', "Specifies domain names for which proxy settings should be ignored for HTTP/HTTPS requests. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true
                },
                'http.proxyAuthorization': {
                    type: ['null', 'string'],
                    default: null,
                    markdownDescription: localize('proxyAuthorization', "The value to send as the `Proxy-Authorization` header for every network request. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true
                },
                'http.proxySupport': {
                    type: 'string',
                    enum: ['off', 'on', 'fallback', 'override'],
                    enumDescriptions: [
                        localize('proxySupportOff', "Disable proxy support for extensions."),
                        localize('proxySupportOn', "Enable proxy support for extensions."),
                        localize('proxySupportFallback', "Enable proxy support for extensions, fall back to request options, when no proxy found."),
                        localize('proxySupportOverride', "Enable proxy support for extensions, override request options."),
                    ],
                    default: 'override',
                    markdownDescription: localize('proxySupport', "Use the proxy support for extensions. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true
                },
                'http.systemCertificates': {
                    type: 'boolean',
                    default: true,
                    markdownDescription: localize('systemCertificates', "Controls whether CA certificates should be loaded from the OS. On Windows and macOS, a reload of the window is required after turning this off. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true
                },
                'http.systemCertificatesNode': {
                    type: 'boolean',
                    tags: ['experimental'],
                    default: systemCertificatesNodeDefault,
                    markdownDescription: localize('systemCertificatesNode', "Controls whether system certificates should be loaded using Node.js built-in support. Reload the window after changing this setting. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true,
                    experiment: {
                        mode: 'auto'
                    }
                },
                'http.experimental.systemCertificatesV2': {
                    type: 'boolean',
                    tags: ['experimental'],
                    default: false,
                    markdownDescription: localize('systemCertificatesV2', "Controls whether experimental loading of CA certificates from the OS should be enabled. This uses a more general approach than the default implementation. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true
                },
                'http.fetchAdditionalSupport': {
                    type: 'boolean',
                    default: true,
                    markdownDescription: localize('fetchAdditionalSupport', "Controls whether Node.js' fetch implementation should be extended with additional support. Currently proxy support ({1}) and system certificates ({2}) are added when the corresponding settings are enabled. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`', '`#http.proxySupport#`', '`#http.systemCertificates#`'),
                    restricted: true
                },
                'http.experimental.networkInterfaceCheckInterval': {
                    type: 'number',
                    default: 300,
                    minimum: -1,
                    tags: ['experimental'],
                    markdownDescription: localize('networkInterfaceCheckInterval', "Controls the interval in seconds for checking network interface changes to invalidate the proxy cache. Set to -1 to disable. When during [remote development](https://aka.ms/vscode-remote) the {0} setting is disabled this setting can be configured in the local and the remote settings separately.", '`#http.useLocalProxyConfiguration#`'),
                    restricted: true,
                    experiment: {
                        mode: 'auto'
                    }
                }
            }
        }
    ];
    configurationRegistry.updateConfigurations({ add: proxyConfiguration, remove: oldProxyConfiguration });
}
registerProxyConfigurations();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVoRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRS9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzQyxPQUFPLEVBQXNCLFVBQVUsRUFBOEMsTUFBTSxxREFBcUQsQ0FBQztBQUNqSixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFOUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRTdELE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBRyxlQUFlLENBQWtCLGdCQUFnQixDQUFDLENBQUM7QUEyQmxGLE1BQU0sZUFBZTtJQUlwQixZQUE2QixRQUFrQjtRQUFsQixhQUFRLEdBQVIsUUFBUSxDQUFVO0lBQUksQ0FBQztJQUVwRCxNQUFNO1FBQ0wsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQixNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3BDLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNqQyxJQUFJLEdBQUcsQ0FBQyxXQUFXLEVBQUUsS0FBSyxlQUFlLElBQUksR0FBRyxDQUFDLFdBQVcsRUFBRSxLQUFLLHFCQUFxQixFQUFFLENBQUM7b0JBQzFGLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUM7Z0JBQ3hCLENB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