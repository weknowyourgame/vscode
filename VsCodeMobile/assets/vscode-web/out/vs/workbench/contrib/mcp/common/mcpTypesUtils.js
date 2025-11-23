/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { disposableTimeout, timeout } from '../../../../base/common/async.js';
import { CancellationError } from '../../../../base/common/errors.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
/**
 * Waits up to `timeout` for a server passing the filter to be discovered,
 * and then starts it.
 */
export function startServerByFilter(mcpService, filter, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const store = new DisposableStore();
        store.add(autorun(reader => {
            const servers = mcpService.servers.read(reader);
            const server = servers.find(filter);
            if (server) {
                server.start({ promptType: 'all-untrusted' }).then(state => {
                    if (state.state === 3 /* McpConnectionState.Kind.Error */) {
                        server.showOutput();
                    }
                });
                resolve();
                store.dispose();
            }
        }));
        store.add(disposableTimeout(() => {
            store.dispose();
            reject(new CancellationError());
        }, timeout));
    });
}
/**
 * Starts a server (if needed) and waits for its tools to be live. Returns
 * true/false whether this happened successfully.
 */
export async function startServerAndWaitForLiveTools(server, opts, token) {
    const r = await server.start(opts);
    const store = new DisposableStore();
    const ok = await new Promise(resolve => {
        if (token?.isCancellationRequested || r.state === 3 /* McpConnectionState.Kind.Error */ || r.state === 0 /* McpConnectionState.Kind.Stopped */) {
            return resolve(false);
        }
        if (token) {
            store.add(token.onCancellationRequested(() => {
                resolve(false);
            }));
        }
        store.add(autorun(reader => {
            const connState = server.connectionState.read(reader).state;
            if (connState === 3 /* McpConnectionState.Kind.Error */ || connState === 0 /* McpConnectionState.Kind.Stopped */) {
                resolve(false); // some error, don't block the request
            }
            const toolState = server.cacheState.read(reader);
            if (toolState === 5 /* McpServerCacheState.Live */) {
                resolve(true); // got tools, all done
            }
        }));
    });
    if (ok) {
        await timeout(0); // let the tools register in the language model contribution
    }
    return ok;
}
export function mcpServerToSourceData(server, reader) {
    const metadata = server.serverMetadata.read(reader);
    return {
        type: 'mcp',
        serverLabel: metadata?.serverName,
        instructions: metadata?.serverInstructions,
        label: server.definition.label,
        collectionId: server.collection.id,
        definitionId: server.definition.id
    };
}
/**
 * Validates whether the given HTTP or HTTPS resource is allowed for the specified MCP server.
 *
 * @param resource The URI of the resource to validate.
 * @param server The MCP server instance to validate against, or undefined.
 * @returns True if the resource request is valid for the server, false otherwise.
 */
export function canLoadMcpNetworkResourceDirectly(resource, server) {
    let isResourceRequestValid = false;
    if (resource.protocol === 'http:') {
        const launch = server?.connection.get()?.launchDefinition;
        if (launch && launch.type === 2 /* McpServerTransportType.HTTP */ && launch.uri.authority.toLowerCase() === resource.hostname.toLowerCase()) {
            isResourceRequestValid = true;
        }
    }
    else if (resource.protocol === 'https:') {
        isResourceRequestValid = true;
    }
    return isResourceRequestValid;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwVHlwZXNVdGlscy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcFR5cGVzVXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTlFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFXLE1BQU0sdUNBQXVDLENBQUM7QUFLekU7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLG1CQUFtQixDQUFDLFVBQXVCLEVBQUUsTUFBa0MsRUFBRSxPQUFPLEdBQUcsSUFBSTtJQUM5RyxPQUFPLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzVDLE1BQU0sS0FBSyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDcEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDMUIsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDaEQsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUVwQyxJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUNaLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7b0JBQzFELElBQUksS0FBSyxDQUFDLEtBQUssMENBQWtDLEVBQUUsQ0FBQzt3QkFDbkQsTUFBTSxDQUFDLFVBQVUsRUFB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