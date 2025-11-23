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
import { Throttler } from '../../../../base/common/async.js';
import * as glob from '../../../../base/common/glob.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { equals as objectsEqual } from '../../../../base/common/objects.js';
import { autorun, autorunDelta, derivedOpts } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IDebugService } from '../../debug/common/debug.js';
import { IMcpRegistry } from './mcpRegistryTypes.js';
let McpDevModeServerAttache = class McpDevModeServerAttache extends Disposable {
    constructor(server, fwdRef, registry, fileService, workspaceContextService) {
        super();
        const workspaceFolder = server.readDefinitions().map(({ collection }) => collection?.presentation?.origin &&
            workspaceContextService.getWorkspaceFolder(collection.presentation?.origin)?.uri);
        const restart = async () => {
            const lastDebugged = fwdRef.lastModeDebugged;
            await server.stop();
            await server.start({ debug: lastDebugged });
        };
        // 1. Auto-start the server, restart if entering debug mode
        let didAutoStart = false;
        this._register(autorun(reader => {
            const defs = server.readDefinitions().read(reader);
            if (!defs.collection || !defs.server || !defs.server.devMode) {
                didAutoStart = false;
                return;
            }
            // don't keep trying to start the server unless it's a new server or devmode is newly turned on
            if (didAutoStart) {
                return;
            }
            const delegates = registry.delegates.read(reader);
            if (!delegates.some(d => d.canStart(defs.collection, defs.server))) {
                return;
            }
            server.start();
            didAutoStart = true;
        }));
        const debugMode = server.readDefinitions().map(d => !!d.server?.devMode?.debug);
        this._register(autorunDelta(debugMode, ({ lastValue, newValue }) => {
            if (!!newValue && !objectsEqual(lastValue, newValue)) {
                restart();
            }
        }));
        // 2. Watch for file changes
        const watchObs = derivedOpts({ equalsFn: arraysEqual }, reader => {
            const def = server.readDefinitions().read(reader);
            const watch = def.server?.devMode?.watch;
            return typeof watch === 'string' ? [watch] : watch;
        });
        const restartScheduler = this._register(new Throttler());
        this._register(autorun(reader => {
            const pattern = watchObs.read(reader);
            const wf = workspaceFolder.read(reader);
            if (!pattern || !wf) {
                return;
            }
            const includes = pattern.filter(p => !p.startsWith('!'));
            const excludes = pattern.filter(p => p.startsWith('!')).map(p => p.slice(1));
            reader.store.add(fileService.watch(wf, { includes, excludes, recursive: true }));
            const includeParse = includes.map(p => glob.parse({ base: wf.fsPath, pattern: p }));
            const excludeParse = excludes.map(p => glob.parse({ base: wf.fsPath, pattern: p }));
            reader.store.add(fileService.onDidFilesChange(e => {
                for (const change of [e.rawAdded, e.rawDeleted, e.rawUpdated]) {
                    for (const uri of change) {
                        if (includeParse.some(i => i(uri.fsPath)) && !excludeParse.some(e => e(uri.fsPath))) {
                            restartScheduler.queue(restart);
                            break;
                        }
                    }
                }
            }));
        }));
    }
};
McpDevModeServerAttache = __decorate([
    __param(2, IMcpRegistry),
    __param(3, IFileService),
    __param(4, IWorkspaceContextService)
], McpDevModeServerAttache);
export { McpDevModeServerAttache };
export const IMcpDevModeDebugging = createDecorator('mcpDevModeDebugging');
const DEBUG_HOST = '127.0.0.1';
let McpDevModeDebugging = class McpDevModeDebugging {
    constructor(_debugService, _commandService) {
        this._debugService = _debugService;
        this._commandService = _commandService;
    }
    async transform(definition, launch) {
        if (!definition.devMode?.debug || launch.type !== 1 /* McpServerTransportType.Stdio */) {
            return launch;
        }
        const port = await this.getDebugPort();
        const name = `MCP: ${definition.label}`; // for debugging
        const options = { startedByUser: false, suppressDebugView: true };
        const commonConfig = {
            internalConsoleOptions: 'neverOpen',
            suppressMultipleSessionWarning: true,
        };
        switch (definition.devMode.debug.type) {
            case 'node': {
                if (!/node[0-9]*$/.test(launch.command)) {
                    throw new Error(localize('mcp.debug.nodeBinReq', 'MCP server must be launched with the "node" executable to enable debugging, but was launched with "{0}"', launch.command));
                }
                // We intentionally assert types as the DA has additional properties beyong IConfig
                // eslint-disable-next-line local/code-no-dangerous-type-assertions
                this._debugService.startDebugging(undefined, {
                    type: 'pwa-node',
                    request: 'attach',
                    name,
                    port,
                    host: DEBUG_HOST,
                    timeout: 30_000,
                    continueOnAttach: true,
                    ...commonConfig,
                }, options);
                return { ...launch, args: [`--inspect-brk=${DEBUG_HOST}:${port}`, ...launch.args] };
            }
            case 'debugpy': {
                if (!/python[0-9.]*$/.test(launch.command)) {
                    throw new Error(localize('mcp.debug.pythonBinReq', 'MCP server must be launched with the "python" executable to enable debugging, but was launched with "{0}"', launch.command));
                }
                let command;
                let args = ['--wait-for-client', '--connect', `${DEBUG_HOST}:${port}`, ...launch.args];
                if (definition.devMode.debug.debugpyPath) {
                    command = definition.devMode.debug.debugpyPath;
                }
                else {
                    try {
                        // The Python debugger exposes a command to get its bundle debugpy module path.  Use that if it's available.
                        const debugPyPath = await this._commandService.executeCommand('python.getDebugpyPackagePath');
                        if (debugPyPath) {
                            command = launch.command;
                            args = [debugPyPath, ...args];
                        }
                    }
                    catch {
                        // ignored, no Python debugger extension installed or an error therein
                    }
                }
                if (!command) {
                    command = 'debugpy';
                }
                await Promise.race([
                    // eslint-disable-next-line local/code-no-dangerous-type-assertions
                    this._debugService.startDebugging(undefined, {
                        type: 'debugpy',
                        name,
                        request: 'attach',
                        listen: {
                            host: DEBUG_HOST,
                            port
                        },
                        ...commonConfig,
                    }, options),
                    this.ensureListeningOnPort(port)
                ]);
                return { ...launch, command, args };
            }
            default:
                assertNever(definition.devMode.debug, `Unknown debug type ${JSON.stringify(definition.devMode.debug)}`);
        }
    }
    ensureListeningOnPort(port) {
        return Promise.resolve();
    }
    getDebugPort() {
        return Promise.resolve(9230);
    }
};
McpDevModeDebugging = __decorate([
    __param(0, IDebugService),
    __param(1, ICommandService)
], McpDevModeDebugging);
export { McpDevModeDebugging };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwRGV2TW9kZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcERldk1vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE1BQU0sSUFBSSxXQUFXLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzdELE9BQU8sS0FBSyxJQUFJLE1BQU0saUNBQWlDLENBQUM7QUFDeEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxNQUFNLElBQUksWUFBWSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDNUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDM0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDMUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzlGLE9BQU8sRUFBVyxhQUFhLEVBQXdCLE1BQU0sNkJBQTZCLENBQUM7QUFDM0YsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRzlDLElBQU0sdUJBQXVCLEdBQTdCLE1BQU0sdUJBQXdCLFNBQVEsVUFBVTtJQUN0RCxZQUNDLE1BQWtCLEVBQ2xCLE1B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