/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { parseEnvFile } from '../../../base/common/envfile.js';
import { untildify } from '../../../base/common/labels.js';
import { Lazy } from '../../../base/common/lazy.js';
import { DisposableMap } from '../../../base/common/lifecycle.js';
import * as path from '../../../base/common/path.js';
import { URI } from '../../../base/common/uri.js';
import { StreamSplitter } from '../../../base/node/nodeStreams.js';
import { findExecutable } from '../../../base/node/processes.js';
import { LogLevel } from '../../../platform/log/common/log.js';
import { McpStdioStateHandler } from '../../contrib/mcp/node/mcpStdioStateHandler.js';
import { ExtHostMcpService, McpHTTPHandle } from '../common/extHostMcp.js';
export class NodeExtHostMpcService extends ExtHostMcpService {
    constructor() {
        super(...arguments);
        this.nodeServers = this._register(new DisposableMap());
    }
    _startMcp(id, launch, defaultCwd, errorOnUserInteraction) {
        if (launch.type === 1 /* McpServerTransportType.Stdio */) {
            this.startNodeMpc(id, launch, defaultCwd);
        }
        else if (launch.type === 2 /* McpServerTransportType.HTTP */) {
            this._sseEventSources.set(id, new McpHTTPHandleNode(id, launch, this._proxy, this._logService, errorOnUserInteraction));
        }
        else {
            super._startMcp(id, launch, defaultCwd, errorOnUserInteraction);
        }
    }
    $stopMcp(id) {
        const nodeServer = this.nodeServers.get(id);
        if (nodeServer) {
            nodeServer.stop(); // will get removed from map when process is fully stopped
        }
        else {
            super.$stopMcp(id);
        }
    }
    $sendMessage(id, message) {
        const nodeServer = this.nodeServers.get(id);
        if (nodeServer) {
            nodeServer.write(message);
        }
        else {
            super.$sendMessage(id, message);
        }
    }
    async startNodeMpc(id, launch, defaultCwd) {
        const onError = (err) => this._proxy.$onDidChangeState(id, {
            state: 3 /* McpConnectionState.Kind.Error */,
            // eslint-disable-next-line local/code-no-any-casts
            code: err.hasOwnProperty('code') ? String(err.code) : undefined,
            message: typeof err === 'string' ? err : err.message,
        });
        // MCP servers are run on the same authority where they are defined, so
        // reading the envfile based on its path off the filesystem here is fine.
        const env = { ...process.env };
        if (launch.envFile) {
            try {
                for (const [key, value] of parseEnvFile(await readFile(launch.envFile, 'utf-8'))) {
                    env[key] = value;
                }
            }
            catch (e) {
                onError(`Failed to read envFile '${launch.envFile}': ${e.message}`);
                return;
            }
        }
        for (const [key, value] of Object.entries(launch.env)) {
            env[key] = value === null ? undefined : String(value);
        }
        let child;
        try {
            const home = homedir();
            let cwd = launch.cwd ? untildify(launch.cwd, home) : (defaultCwd?.fsPath || home);
            if (!path.isAbsolute(cwd)) {
                cwd = defaultCwd ? path.join(defaultCwd.fsPath, cwd) : path.join(home, cwd);
            }
            const { executable, args, shell } = await formatSubprocessArguments(untildify(launch.command, home), launch.args.map(a => untildify(a, home)), cwd, env);
            this._proxy.$onDidPublishLog(id, LogLevel.Debug, `Server command line: ${executable} ${args.join(' ')}`);
            child = spawn(executable, args, {
                stdio: 'pipe',
                cwd,
                env,
                shell,
            });
        }
        catch (e) {
            onError(e);
            return;
        }
        // Create the connection manager for graceful shutdown
        const connectionManager = new McpStdioStateHandler(child);
        this._proxy.$onDidChangeState(id, { state: 1 /* McpConnectionState.Kind.Starting */ });
        child.stdout.pipe(new StreamSplitter('\n')).on('data', line => this._proxy.$onDidReceiveMessage(id, line.toString()));
        child.stdin.on('error', onError);
        child.stdout.on('error', onError);
        // Stderr handling is not currently specified https://github.com/modelcontextprotocol/specification/issues/177
        // Just treat it as generic log data for now
        child.stderr.pipe(new StreamSplitter('\n')).on('data', line => this._proxy.$onDidPublishLog(id, LogLevel.Warning, `[server stderr] ${line.toString().trimEnd()}`));
        child.on('spawn', () => this._proxy.$onDidChangeState(id, { state: 2 /* McpConnectionState.Kind.Running */ }));
        child.on('error', e => {
            onError(e);
        });
        child.on('exit', code => {
            this.nodeServers.deleteAndDispose(id);
            if (code === 0 || connectionManager.stopped) {
                this._proxy.$onDidChangeState(id, { state: 0 /* McpConnectionState.Kind.Stopped */ });
            }
            else {
                this._proxy.$onDidChangeState(id, {
                    state: 3 /* McpConnectionState.Kind.Error */,
                    message: `Process exited with code ${code}`,
                });
            }
        });
        this.nodeServers.set(id, connectionManager);
    }
}
class McpHTTPHandleNode extends McpHTTPHandle {
    constructor() {
        super(...arguments);
        this._undici = new Lazy(() => import('undici'));
    }
    async _fetchInternal(url, init) {
        // Note: imported async so that we can ensure we load undici after proxy patches have been applied
        const { fetch, Agent } = await this._undici.value;
        const undiciInit = { ...init };
        let httpUrl = url;
        const uri = URI.parse(url);
        if (uri.scheme === 'unix' || uri.scheme === 'pipe') {
            // By convention, we put the *socket path* as the URI path, and the *request path* in the fragment
            // So, set the dispatcher with the socket path
            undiciInit.dispatcher = new Agent({
                socketPath: uri.path,
            });
            // And then rewrite the URL to be http://localhost/<fragment>
            httpUrl = uri.with({
                scheme: 'http',
                authority: 'localhost', // HTTP always wants a host (not that we're using it), but if we're using a socket or pipe then localhost is sorta right anyway
                path: uri.fragment,
            }).toString(true);
        }
        else {
            return super._fetchInternal(url, init);
        }
        const undiciResponse = await fetch(httpUrl, undiciInit);
        return {
            status: undiciResponse.status,
            statusText: undiciResponse.statusText,
            headers: undiciResponse.headers,
            body: undiciResponse.body, // Way down in `ReadableStreamReadDoneResult<T>`, `value` is optional in the undici type but required (yet can be `undefined`) in the standard type
            url: undiciResponse.url,
            json: () => undiciResponse.json(),
            text: () => undiciResponse.text(),
        };
    }
}
const windowsShellScriptRe = /\.(bat|cmd)$/i;
/**
 * Formats arguments to avoid issues on Windows for CVE-2024-27980.
 */
export const formatSubprocessArguments = async (executable, args, cwd, env) => {
    if (process.platform !== 'win32') {
        return { executable, args, shell: false };
    }
    const found = await findExecutable(executable, cwd, undefined, env);
    if (found && windowsShellScriptRe.test(found)) {
        const quote = (s) => s.includes(' ') ? `"${s}"` : s;
        return {
            executable: quote(found),
            args: args.map(quote),
            shell: true,
        };
    }
    return { executable, args, shell: false };
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdE1jcE5vZGUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9ub2RlL2V4dEhvc3RNY3BOb2RlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBa0MsS0FBSyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDdkMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLElBQUksQ0FBQztBQUU3QixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDL0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDbEUsT0FBTyxLQUFLLElBQUksTUFBTSw4QkFBOEIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFL0QsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDdEYsT0FBTyxFQUFxQyxpQkFBaUIsRUFBRSxhQUFhLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUU5RyxNQUFNLE9BQU8scUJBQXNCLFNBQVEsaUJBQWlCO0lBQTVEOztRQUNTLGdCQUFXLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGFBQWEsRUFBZ0MsQ0FBQyxDQUFDO0lBb0h6RixDQUFD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