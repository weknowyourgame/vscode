/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EditorWorkerClient } from '../../browser/services/editorWorkerService.js';
/**
 * Create a new web worker that has model syncing capabilities built in.
 * Specify an AMD module to load that will `create` an object that will be proxied.
 */
export function createWebWorker(modelService, webWorkerService, opts) {
    return new MonacoWebWorkerImpl(modelService, webWorkerService, opts);
}
class MonacoWebWorkerImpl extends EditorWorkerClient {
    constructor(modelService, webWorkerService, opts) {
        super(opts.worker, opts.keepIdleModels || false, modelService, webWorkerService);
        this._foreignModuleHost = opts.host || null;
        this._foreignProxy = this._getProxy().then(proxy => {
            return new Proxy({}, {
                get(target, prop, receiver) {
                    if (prop === 'then') {
                        // Don't forward the call when the proxy is returned in an async function and the runtime tries to .then it.
                        return undefined;
                    }
                    if (typeof prop !== 'string') {
                        throw new Error(`Not supported`);
                    }
                    return (...args) => {
                        return proxy.$fmr(prop, args);
                    };
                }
            });
        });
    }
    // foreign host request
    fhr(method, args) {
        if (!this._foreignModuleHost || typeof this._foreignModuleHost[method] !== 'function') {
            return Promise.reject(new Error('Missing method ' + method + ' or missing main thread foreign host.'));
        }
        try {
            return Promise.resolve(this._foreignModuleHost[method].apply(this._foreignModuleHost, args));
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    getProxy() {
        return this._foreignProxy;
    }
    withSyncedResources(resources) {
        return this.workerWithSyncedResources(resources).then(_ => this.getProxy());
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhbG9uZVdlYldvcmtlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3Ivc3RhbmRhbG9uZS9icm93c2VyL3N0YW5kYWxvbmVXZWJXb3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFHbkY7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FBbUIsWUFBMkIsRUFBRSxnQkFBbUMsRUFBRSxJQUErQjtJQUNsSixPQUFPLElBQUksbUJBQW1CLENBQUksWUFBWSxFQUFFLGdCQUFnQixFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3pFLENBQUM7QUFxQ0QsTUFBTSxtQkFBc0MsU0FBUSxrQkFBa0I7SUFLckUsWUFBWSxZQUEyQixFQUFFLGdCQUFtQyxFQUFFLElBQStCO1FBQzVHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxjQUFjLElBQUksS0FBSyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ2pGLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztRQUM1QyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDbEQsT0FBTyxJQUFJLEtBQUssQ0FBQyxFQUFFLEVBQUU7Z0JBQ3BCLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLFFBQVE7b0JBQ3pCLElBQUksSUFBSSxLQUFLLE1BQU0sRUFBRSxDQUFDO3dCQUNyQiw0R0FBNEc7d0JBQzVHLE9BQU8sU0FBUyxDQUFDO29CQUNsQixDQUFDO29CQUNELElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7d0JBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7b0JBQ2xDLENBQUM7b0JBQ0QsT0FBTyxDQUFDLEdBQUcsSUFBZSxFQUFFLEVBQUU7d0JBQzdCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQy9CLENBQUMsQ0FBQztnQkFDSCxDQUFDO2FBQ0QsQ0FBTSxDQUFDO1FBQ1QsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsdUJBQXVCO0lBQ1AsR0FBRyxDQUFDLE1BQWMsRUFBRSxJQUFlO1FBQ2xELElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLElBQUksT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEtBQUssVUFBVSxFQUFFLENBQUM7WUFDdkYsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLGlCQUFpQixHQUFHLE1BQU0sR0FBRyx1Q0FBdUMsQ0FBQyxDQUFDLENBQUM7UUFDeEcsQ0FBQztRQUVELElBQUksQ0FBQztZQUNKLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzlGLENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ1osT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFCLENBQUM7SUFDRixDQUFDO0lBRU0sUUFBUTtRQUNkLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUMzQixDQUFDO0lBRU0sbUJBQW1CLENBQUMsU0FBZ0I7UUFDMUMsT0FBTyxJQUFJLENBQUMseUJBQXlCLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDN0UsQ0FBQztDQUNEIn0=