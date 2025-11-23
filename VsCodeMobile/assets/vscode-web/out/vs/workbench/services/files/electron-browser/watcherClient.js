/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getDelayedChannel, ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { AbstractUniversalWatcherClient } from '../../../../platform/files/common/watcher.js';
export class UniversalWatcherClient extends AbstractUniversalWatcherClient {
    constructor(onFileChanges, onLogMessage, verboseLogging, utilityProcessWorkerWorkbenchService) {
        super(onFileChanges, onLogMessage, verboseLogging);
        this.utilityProcessWorkerWorkbenchService = utilityProcessWorkerWorkbenchService;
        this.init();
    }
    createWatcher(disposables) {
        const watcher = ProxyChannel.toService(getDelayedChannel((async () => {
            // Acquire universal watcher via utility process worker
            //
            // We explicitly do not add the worker as a disposable
            // because we need to call `stop` on disposal to prevent
            // a crash on shutdown (see below).
            //
            // The utility process worker services ensures to terminate
            // the process automatically when the window closes or reloads.
            const { client, onDidTerminate } = disposables.add(await this.utilityProcessWorkerWorkbenchService.createWorker({
                moduleId: 'vs/platform/files/node/watcher/watcherMain',
                type: 'fileWatcher',
                name: 'file-watcher'
            }));
            // React on unexpected termination of the watcher process
            // by listening to the `onDidTerminate` event. We do not
            // consider an exit code of `0` as abnormal termination.
            onDidTerminate.then(({ reason }) => {
                if (reason?.code === 0) {
                    this.trace(`terminated by itself with code ${reason.code}, signal: ${reason.signal}`);
                }
                else {
                    this.onError(`terminated by itself unexpectedly with code ${reason?.code}, signal: ${reason?.signal} (ETERM)`);
                }
            });
            return client.getChannel('watcher');
        })()));
        return watcher;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2hlckNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvZmlsZXMvZWxlY3Ryb24tYnJvd3Nlci93YXRjaGVyQ2xpZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUUzRixPQUFPLEVBQUUsOEJBQThCLEVBQWtDLE1BQU0sOENBQThDLENBQUM7QUFHOUgsTUFBTSxPQUFPLHNCQUF1QixTQUFRLDhCQUE4QjtJQUV6RSxZQUNDLGFBQStDLEVBQy9DLFlBQXdDLEVBQ3hDLGNBQXVCLEVBQ04sb0NBQTJFO1FBRTVGLEtBQUssQ0FBQyxhQUFhLEVBQUUsWUFBWSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBRmxDLHlDQUFvQyxHQUFwQyxvQ0FBb0MsQ0FBdUM7UUFJNUYsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQztJQUVrQixhQUFhLENBQUMsV0FBNEI7UUFDNUQsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBb0IsaUJBQWlCLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRTtZQUV2Rix1REFBdUQ7WUFDdkQsRUFBRTtZQUNGLHNEQUFzRDtZQUN0RCx3REFBd0Q7WUFDeEQsbUNBQW1DO1lBQ25DLEVBQUU7WUFDRiwyREFBMkQ7WUFDM0QsK0RBQStEO1lBQy9ELE1BQU0sRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxZQUFZLENBQUM7Z0JBQy9HLFFBQVEsRUFBRSw0Q0FBNEM7Z0JBQ3RELElBQUksRUFBRSxhQUFhO2dCQUNuQixJQUFJLEVBQUUsY0FBYzthQUNwQixDQUFDLENBQUMsQ0FBQztZQUVKLHlEQUF5RDtZQUN6RCx3REFBd0Q7WUFDeEQsd0RBQXdEO1lBRXhELGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUU7Z0JBQ2xDLElBQUksTUFBTSxFQUFFLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQ0FBa0MsTUFBTSxDQUFDLElBQUksYUFBYSxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztnQkFDdkYsQ0FBQztxQkFBTSxDQUFDO29CQUNQLElBQUksQ0FBQyxPQUFPLENBQUMsK0NBQStDLE1BQU0sRUFBRSxJQUFJLGFBQWEsTUFBTSxFQUFFLE1BQU0sVUFBVSxDQUFDLENBQUM7Z0JBQ2hILENBQUM7WUFDRixDQUFDLENBQUMsQ0FBQztZQUVILE9BQU8sTUFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUVQLE9BQU8sT0FBTyxDQUFDO0lBQ2hCLENBQUM7Q0FDRCJ9