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
import * as nls from '../../nls.js';
import { NativeEnvironmentService } from '../../platform/environment/node/environmentService.js';
import { OPTIONS } from '../../platform/environment/node/argv.js';
import { refineServiceDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IEnvironmentService } from '../../platform/environment/common/environment.js';
import { memoize } from '../../base/common/decorators.js';
import { URI } from '../../base/common/uri.js';
import { joinPath } from '../../base/common/resources.js';
import { join } from '../../base/common/path.js';
export const serverOptions = {
    /* ----- server setup ----- */
    'host': { type: 'string', cat: 'o', args: 'ip-address', description: nls.localize('host', "The host name or IP address the server should listen to. If not set, defaults to 'localhost'.") },
    'port': { type: 'string', cat: 'o', args: 'port | port range', description: nls.localize('port', "The port the server should listen to. If 0 is passed a random free port is picked. If a range in the format num-num is passed, a free port from the range (end inclusive) is selected.") },
    'socket-path': { type: 'string', cat: 'o', args: 'path', description: nls.localize('socket-path', "The path to a socket file for the server to listen to.") },
    'server-base-path': { type: 'string', cat: 'o', args: 'path', description: nls.localize('server-base-path', "The path under which the web UI and the code server is provided. Defaults to '/'.`") },
    'connection-token': { type: 'string', cat: 'o', args: 'token', deprecates: ['connectionToken'], description: nls.localize('connection-token', "A secret that must be included with all requests.") },
    'connection-token-file': { type: 'string', cat: 'o', args: 'path', deprecates: ['connection-secret', 'connectionTokenFile'], description: nls.localize('connection-token-file', "Path to a file that contains the connection token.") },
    'without-connection-token': { type: 'boolean', cat: 'o', description: nls.localize('without-connection-token', "Run without a connection token. Only use this if the connection is secured by other means.") },
    'disable-websocket-compression': { type: 'boolean' },
    'print-startup-performance': { type: 'boolean' },
    'print-ip-address': { type: 'boolean' },
    'accept-server-license-terms': { type: 'boolean', cat: 'o', description: nls.localize('acceptLicenseTerms', "If set, the user accepts the server license terms and the server will be started without a user prompt.") },
    'server-data-dir': { type: 'string', cat: 'o', description: nls.localize('serverDataDir', "Specifies the directory that server data is kept in.") },
    'telemetry-level': { type: 'string', cat: 'o', args: 'level', description: nls.localize('telemetry-level', "Sets the initial telemetry level. Valid levels are: 'off', 'crash', 'error' and 'all'. If not specified, the server will send telemetry until a client connects, it will then use the clients telemetry setting. Setting this to 'off' is equivalent to --disable-telemetry") },
    /* ----- vs code options ---	-- */
    'user-data-dir': OPTIONS['user-data-dir'],
    'enable-smoke-test-driver': OPTIONS['enable-smoke-test-driver'],
    'disable-telemetry': OPTIONS['disable-telemetry'],
    'disable-experiments': OPTIONS['disable-experiments'],
    'disable-workspace-trust': OPTIONS['disable-workspace-trust'],
    'file-watcher-polling': { type: 'string', deprecates: ['fileWatcherPolling'] },
    'log': OPTIONS['log'],
    'logsPath': OPTIONS['logsPath'],
    'force-disable-user-env': OPTIONS['force-disable-user-env'],
    'enable-proposed-api': OPTIONS['enable-proposed-api'],
    /* ----- vs code web options ----- */
    'folder': { type: 'string', deprecationMessage: 'No longer supported. Folder needs to be provided in the browser URL or with `default-folder`.' },
    'workspace': { type: 'string', deprecationMessage: 'No longer supported. Workspace needs to be provided in the browser URL or with `default-workspace`.' },
    'default-folder': { type: 'string', description: nls.localize('default-folder', 'The workspace folder to open when no input is specified in the browser URL. A relative or absolute path resolved against the current working directory.') },
    'default-workspace': { type: 'string', description: nls.localize('default-workspace', 'The workspace to open when no input is specified in the browser URL. A relative or absolute path resolved against the current working directory.') },
    'enable-sync': { type: 'boolean' },
    'github-auth': { type: 'string' },
    'use-test-resolver': { type: 'boolean' },
    /* ----- extension management ----- */
    'extensions-dir': OPTIONS['extensions-dir'],
    'extensions-download-dir': OPTIONS['extensions-download-dir'],
    'builtin-extensions-dir': OPTIONS['builtin-extensions-dir'],
    'install-extension': OPTIONS['install-extension'],
    'install-builtin-extension': OPTIONS['install-builtin-extension'],
    'update-extensions': OPTIONS['update-extensions'],
    'uninstall-extension': OPTIONS['uninstall-extension'],
    'list-extensions': OPTIONS['list-extensions'],
    'locate-extension': OPTIONS['locate-extension'],
    'show-versions': OPTIONS['show-versions'],
    'category': OPTIONS['category'],
    'force': OPTIONS['force'],
    'do-not-sync': OPTIONS['do-not-sync'],
    'do-not-include-pack-dependencies': OPTIONS['do-not-include-pack-dependencies'],
    'pre-release': OPTIONS['pre-release'],
    'start-server': { type: 'boolean', cat: 'e', description: nls.localize('start-server', "Start the server when installing or uninstalling extensions. To be used in combination with 'install-extension', 'install-builtin-extension' and 'uninstall-extension'.") },
    /* ----- remote development options ----- */
    'enable-remote-auto-shutdown': { type: 'boolean' },
    'remote-auto-shutdown-without-delay': { type: 'boolean' },
    'inspect-ptyhost': { type: 'string', allowEmptyValue: true },
    'use-host-proxy': { type: 'boolean' },
    'without-browser-env-var': { type: 'boolean' },
    'reconnection-grace-time': { type: 'string', cat: 'o', args: 'seconds', description: nls.localize('reconnection-grace-time', "Override the reconnection grace time window in seconds. Defaults to 10800 (3 hours).") },
    /* ----- server cli ----- */
    'help': OPTIONS['help'],
    'version': OPTIONS['version'],
    'locate-shell-integration-path': OPTIONS['locate-shell-integration-path'],
    'compatibility': { type: 'string' },
    _: OPTIONS['_']
};
export const IServerEnvironmentService = refineServiceDecorator(IEnvironmentService);
export class ServerEnvironmentService extends NativeEnvironmentService {
    get userRoamingDataHome() { return this.appSettingsHome; }
    get machineSettingsResource() { return joinPath(URI.file(join(this.userDataPath, 'Machine')), 'settings.json'); }
    get mcpResource() { return joinPath(URI.file(join(this.userDataPath, 'User')), 'mcp.json'); }
    get args() { return super.args; }
    get reconnectionGraceTime() { return parseGraceTime(this.args['reconnection-grace-time'], 10800000 /* ProtocolConstants.ReconnectionGraceTime */); }
}
__decorate([
    memoize
], ServerEnvironmentService.prototype, "userRoamingDataHome", null);
__decorate([
    memoize
], ServerEnvironmentService.prototype, "machineSettingsResource", null);
__decorate([
    memoize
], ServerEnvironmentService.prototype, "mcpResource", null);
__decorate([
    memoize
], ServerEnvironmentService.prototype, "reconnectionGraceTime", null);
function parseGraceTime(rawValue, fallback) {
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
        console.log(`[reconnection-grace-time] No CLI argument provided, using default: ${fallback}ms (${Math.floor(fallback / 1000)}s)`);
        return fallback;
    }
    const parsedSeconds = Number(rawValue);
    if (!isFinite(parsedSeconds) || parsedSeconds < 0) {
        console.log(`[reconnection-grace-time] Invalid value '${rawValue}', using default: ${fallback}ms (${Math.floor(fallback / 1000)}s)`);
        return fallback;
    }
    const millis = Math.floor(parsedSeconds * 1000);
    if (!isFinite(millis) || millis > Number.MAX_SAFE_INTEGER) {
        console.log(`[reconnection-grace-time] Value too large '${rawValue}', using default: ${fallback}ms (${Math.floor(fallback / 1000)}s)`);
        return fallback;
    }
    console.log(`[reconnection-grace-time] Parsed CLI argument: ${parsedSeconds}s -> ${millis}ms`);
    return millis;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyRW52aXJvbm1lbnRTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3NlcnZlci9ub2RlL3NlcnZlckVudmlyb25tZW50U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGNBQWMsQ0FBQztBQUVwQyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsT0FBTyxFQUFzQixNQUFNLHlDQUF5QyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxtQkFBbUIsRUFBNkIsTUFBTSxrREFBa0QsQ0FBQztBQUNsSCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFHakQsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFtRDtJQUU1RSw4QkFBOEI7SUFFOUIsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLCtGQUErRixDQUFDLEVBQUU7SUFDNUwsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxtQkFBbUIsRUFBRSxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsd0xBQXdMLENB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