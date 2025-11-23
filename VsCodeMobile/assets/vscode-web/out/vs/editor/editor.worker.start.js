/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { initialize } from '../base/common/worker/webWorkerBootstrap.js';
import { EditorWorker } from './common/services/editorWebWorker.js';
import { EditorWorkerHost } from './common/services/editorWorkerHost.js';
/**
 * Used by `monaco-editor` to hook up web worker rpc.
 * @skipMangle
 * @internal
 */
export function start(createClient) {
    let client;
    const webWorkerServer = initialize((workerServer) => {
        const editorWorkerHost = EditorWorkerHost.getChannel(workerServer);
        const host = new Proxy({}, {
            get(target, prop, receiver) {
                if (prop === 'then') {
                    // Don't forward the call when the proxy is returned in an async function and the runtime tries to .then it.
                    return undefined;
                }
                if (typeof prop !== 'string') {
                    throw new Error(`Not supported`);
                }
                return (...args) => {
                    return editorWorkerHost.$fhr(prop, args);
                };
            }
        });
        const ctx = {
            host: host,
            getMirrorModels: () => {
                return webWorkerServer.requestHandler.getModels();
            }
        };
        client = createClient(ctx);
        return new EditorWorker(client);
    });
    return client;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yLndvcmtlci5zdGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvZWRpdG9yLndvcmtlci5zdGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDekUsT0FBTyxFQUFFLFlBQVksRUFBa0IsTUFBTSxzQ0FBc0MsQ0FBQztBQUNwRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUV6RTs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLEtBQUssQ0FBK0MsWUFBcUQ7SUFDeEgsSUFBSSxNQUEyQixDQUFDO0lBQ2hDLE1BQU0sZUFBZSxHQUFHLFVBQVUsQ0FBQyxDQUFDLFlBQVksRUFBRSxFQUFFO1FBQ25ELE1BQU0sZ0JBQWdCLEdBQUcsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRW5FLE1BQU0sSUFBSSxHQUFHLElBQUksS0FBSyxDQUFDLEVBQUUsRUFBRTtZQUMxQixHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxRQUFRO2dCQUN6QixJQUFJLElBQUksS0FBSyxNQUFNLEVBQUUsQ0FBQztvQkFDckIsNEdBQTRHO29CQUM1RyxPQUFPLFNBQVMsQ0FBQztnQkFDbEIsQ0FBQztnQkFDRCxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO29CQUM5QixNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUNsQyxDQUFDO2dCQUNELE9BQU8sQ0FBQyxHQUFHLElBQWUsRUFBRSxFQUFFO29CQUM3QixPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzFDLENBQUMsQ0FBQztZQUNILENBQUM7U0FDRCxDQUFDLENBQUM7UUFFSCxNQUFNLEdBQUcsR0FBMEI7WUFDbEMsSUFBSSxFQUFFLElBQWE7WUFDbkIsZUFBZSxFQUFFLEdBQUcsRUFBRTtnQkFDckIsT0FBTyxlQUFlLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ25ELENBQUM7U0FDRCxDQUFDO1FBRUYsTUFBTSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUUzQixPQUFPLElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxNQUFPLENBQUM7QUFDaEIsQ0FBQyJ9