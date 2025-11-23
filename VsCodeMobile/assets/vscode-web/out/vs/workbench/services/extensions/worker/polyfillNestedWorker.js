/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const _bootstrapFnSource = (function _bootstrapFn(workerUrl) {
    const listener = (event) => {
        // uninstall handler
        globalThis.removeEventListener('message', listener);
        // get data
        const port = event.data;
        // postMessage
        // onmessage
        Object.defineProperties(globalThis, {
            'postMessage': {
                value(data, transferOrOptions) {
                    port.postMessage(data, transferOrOptions);
                }
            },
            'onmessage': {
                get() {
                    return port.onmessage;
                },
                set(value) {
                    port.onmessage = value;
                }
            }
            // todo onerror
        });
        port.addEventListener('message', msg => {
            globalThis.dispatchEvent(new MessageEvent('message', { data: msg.data, ports: msg.ports ? [...msg.ports] : undefined }));
        });
        port.start();
        // fake recursively nested worker
        // eslint-disable-next-line local/code-no-any-casts
        globalThis.Worker = class {
            constructor() { throw new TypeError('Nested workers from within nested worker are NOT supported.'); }
        };
        // load module
        importScripts(workerUrl);
    };
    globalThis.addEventListener('message', listener);
}).toString();
export class NestedWorker extends EventTarget {
    constructor(nativePostMessage, stringOrUrl, options) {
        super();
        this.onmessage = null;
        this.onmessageerror = null;
        this.onerror = null;
        // create bootstrap script
        const bootstrap = `((${_bootstrapFnSource})('${stringOrUrl}'))`;
        const blob = new Blob([bootstrap], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const channel = new MessageChannel();
        const id = blobUrl; // works because blob url is unique, needs ID pool otherwise
        const msg = {
            type: '_newWorker',
            id,
            port: channel.port2,
            url: blobUrl,
            options,
        };
        nativePostMessage(msg, [channel.port2]);
        // worker-impl: functions
        this.postMessage = channel.port1.postMessage.bind(channel.port1);
        this.terminate = () => {
            const msg = {
                type: '_terminateWorker',
                id
            };
            nativePostMessage(msg);
            URL.revokeObjectURL(blobUrl);
            channel.port1.close();
            channel.port2.close();
        };
        // worker-impl: events
        Object.defineProperties(this, {
            'onmessage': {
                get() {
                    return channel.port1.onmessage;
                },
                set(value) {
                    channel.port1.onmessage = value;
                }
            },
            'onmessageerror': {
                get() {
                    return channel.port1.onmessageerror;
                },
                set(value) {
                    channel.port1.onmessageerror = value;
                }
            },
            // todo onerror
        });
        channel.port1.addEventListener('messageerror', evt => {
            const msgEvent = new MessageEvent('messageerror', { data: evt.data });
            this.dispatchEvent(msgEvent);
        });
        channel.port1.addEventListener('message', evt => {
            const msgEvent = new MessageEvent('message', { data: evt.data });
            this.dispatchEvent(msgEvent);
        });
        channel.port1.start();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9seWZpbGxOZXN0ZWRXb3JrZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2V4dGVuc2lvbnMvd29ya2VyL3BvbHlmaWxsTmVzdGVkV29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBUWhHLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxTQUFTLFlBQVksQ0FBQyxTQUFpQjtJQUVsRSxNQUFNLFFBQVEsR0FBa0IsQ0FBQyxLQUFZLEVBQVEsRUFBRTtRQUN0RCxvQkFBb0I7UUFDcEIsVUFBVSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUVwRCxXQUFXO1FBQ1gsTUFBTSxJQUFJLEdBQStCLEtBQU0sQ0FBQyxJQUFJLENBQUM7UUFFckQsY0FBYztRQUNkLFlBQVk7UUFDWixNQUFNLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFO1lBQ25DLGFBQWEsRUFBRTtnQkFDZCxLQUFLLENBQUMsSUFBUyxFQUFFLGlCQUF1QjtvQkFDdkMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztnQkFDM0MsQ0FBQzthQUNEO1lBQ0QsV0FBVyxFQUFFO2dCQUNaLEdBQUc7b0JBQ0YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUN2QixDQUFDO2dCQUNELEdBQUcsQ0FBQyxLQUEwQjtvQkFDN0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7Z0JBQ3hCLENBQUM7YUFDRDtZQUNELGVBQWU7U0FDZixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxFQUFFO1lBQ3RDLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxZQUFZLENBQUMsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVB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