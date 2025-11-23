/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { VSBuffer } from '../../../base/common/buffer.js';
import { Emitter } from '../../../base/common/event.js';
import { isMessageOfType, createMessageOfType } from '../../services/extensions/common/extensionHostProtocol.js';
import { ExtensionHostMain } from '../common/extensionHostMain.js';
import { NestedWorker } from '../../services/extensions/worker/polyfillNestedWorker.js';
import * as path from '../../../base/common/path.js';
import * as performance from '../../../base/common/performance.js';
import '../common/extHost.common.services.js';
import './extHost.worker.services.js';
import { FileAccess } from '../../../base/common/network.js';
import { URI } from '../../../base/common/uri.js';
const nativeClose = self.close.bind(self);
self.close = () => console.trace(`'close' has been blocked`);
const nativePostMessage = postMessage.bind(self);
self.postMessage = () => console.trace(`'postMessage' has been blocked`);
function shouldTransformUri(uri) {
    // In principle, we could convert any URI, but we have concerns
    // that parsing https URIs might end up decoding escape characters
    // and result in an unintended transformation
    return /^(file|vscode-remote):/i.test(uri);
}
const nativeFetch = fetch.bind(self);
function patchFetching(asBrowserUri) {
    self.fetch = async function (input, init) {
        if (input instanceof Request) {
            // Request object - massage not supported
            return nativeFetch(input, init);
        }
        if (shouldTransformUri(String(input))) {
            input = (await asBrowserUri(URI.parse(String(input)))).toString(true);
        }
        return nativeFetch(input, init);
    };
    self.XMLHttpRequest = class extends XMLHttpRequest {
        open(method, url, async, username, password) {
            (async () => {
                if (shouldTransformUri(url.toString())) {
                    url = (await asBrowserUri(URI.parse(url.toString()))).toString(true);
                }
                super.open(method, url, async ?? true, username, password);
            })();
        }
    };
}
self.importScripts = () => { throw new Error(`'importScripts' has been blocked`); };
// const nativeAddEventListener = addEventListener.bind(self);
self.addEventListener = () => console.trace(`'addEventListener' has been blocked`);
// eslint-disable-next-line local/code-no-any-casts
self['AMDLoader'] = undefined;
// eslint-disable-next-line local/code-no-any-casts
self['NLSLoaderPlugin'] = undefined;
// eslint-disable-next-line local/code-no-any-casts
self['define'] = undefined;
// eslint-disable-next-line local/code-no-any-casts
self['require'] = undefined;
// eslint-disable-next-line local/code-no-any-casts
self['webkitRequestFileSystem'] = undefined;
// eslint-disable-next-line local/code-no-any-casts
self['webkitRequestFileSystemSync'] = undefined;
// eslint-disable-next-line local/code-no-any-casts
self['webkitResolveLocalFileSystemSyncURL'] = undefined;
// eslint-disable-next-line local/code-no-any-casts
self['webkitResolveLocalFileSystemURL'] = undefined;
// eslint-disable-next-line local/code-no-any-casts
if (self.Worker) {
    // make sure new Worker(...) always uses blob: (to maintain current origin)
    // eslint-disable-next-line local/code-no-any-casts
    const _Worker = self.Worker;
    // eslint-disable-next-line local/code-no-any-casts
    Worker = function (stringUrl, options) {
        if (/^file:/i.test(stringUrl.toString())) {
            stringUrl = FileAccess.uriToBrowserUri(URI.parse(stringUrl.toString())).toString(true);
        }
        else if (/^vscode-remote:/i.test(stringUrl.toString())) {
            // Supporting transformation of vscode-remote URIs requires an async call to the main thread,
            // but we cannot do this call from within the embedded Worker, and the only way out would be
            // to use templating instead of a function in the web api (`resourceUriProvider`)
            throw new Error(`Creating workers from remote extensions is currently not supported.`);
        }
        // IMPORTANT: bootstrapFn is stringified and injected as worker blob-url. Because of that it CANNOT
        // have dependencies on other functions or variables. Only constant values are supported. Due to
        // that logic of FileAccess.asBrowserUri had to be copied, see `asWorkerBrowserUrl` (below).
        const bootstrapFnSource = (function bootstrapFn(workerUrl) {
            function asWorkerBrowserUrl(url) {
                if (typeof url === 'string' || url instanceof URL) {
                    return String(url).replace(/^file:\/\//i, 'vscode-file://vscode-app');
                }
                return url;
            }
            const nativeFetch = fetch.bind(self);
            self.fetch = function (input, init) {
                if (input instanceof Request) {
                    // Request object - massage not supported
                    return nativeFetch(input, init);
                }
                return nativeFetch(asWorkerBrowserUrl(input), init);
            };
            self.XMLHttpRequest = class extends XMLHttpRequest {
                open(method, url, async, username, password) {
                    return super.open(method, asWorkerBrowserUrl(url), async ?? true, username, password);
                }
            };
            const nativeImportScripts = importScripts.bind(self);
            self.importScripts = (...urls) => {
                nativeImportScripts(...urls.map(asWorkerBrowserUrl));
            };
            nativeImportScripts(workerUrl);
        }).toString();
        const js = `(${bootstrapFnSource}('${stringUrl}'))`;
        options = options || {};
        options.name = `${name} -> ${options.name || path.basename(stringUrl.toString())}`;
        const blob = new Blob([js], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        return new _Worker(blobUrl, options);
    };
}
else {
    // eslint-disable-next-line local/code-no-any-casts
    self.Worker = class extends NestedWorker {
        constructor(stringOrUrl, options) {
            super(nativePostMessage, stringOrUrl, { name: path.basename(stringOrUrl.toString()), ...options });
        }
    };
}
//#endregion ---
const hostUtil = new class {
    constructor() {
        this.pid = undefined;
    }
    exit(_code) {
        nativeClose();
    }
};
class ExtensionWorker {
    constructor() {
        const channel = new MessageChannel();
        const emitter = new Emitter();
        let terminating = false;
        // send over port2, keep port1
        nativePostMessage(channel.port2, [channel.port2]);
        channel.port1.onmessage = event => {
            const { data } = event;
            if (!(data instanceof ArrayBuffer)) {
                console.warn('UNKNOWN data received', data);
                return;
            }
            const msg = VSBuffer.wrap(new Uint8Array(data, 0, data.byteLength));
            if (isMessageOfType(msg, 2 /* MessageType.Terminate */)) {
                // handle terminate-message right here
                terminating = true;
                onTerminate('received terminate message from renderer');
                return;
            }
            // emit non-terminate messages to the outside
            emitter.fire(msg);
        };
        this.protocol = {
            onMessage: emitter.event,
            send: vsbuf => {
                if (!terminating) {
                    const data = vsbuf.buffer.buffer.slice(vsbuf.buffer.byteOffset, vsbuf.buffer.byteOffset + vsbuf.buffer.byteLength);
                    channel.port1.postMessage(data, [data]);
                }
            }
        };
    }
}
function connectToRenderer(protocol) {
    return new Promise(resolve => {
        const once = protocol.onMessage(raw => {
            once.dispose();
            const initData = JSON.parse(raw.toString());
            protocol.send(createMessageOfType(0 /* MessageType.Initialized */));
            resolve({ protocol, initData });
        });
        protocol.send(createMessageOfType(1 /* MessageType.Ready */));
    });
}
let onTerminate = (reason) => nativeClose();
function isInitMessage(a) {
    return !!a && typeof a === 'object' && a.type === 'vscode.init' && a.data instanceof Map;
}
export function create() {
    performance.mark(`code/extHost/willConnectToRenderer`);
    const res = new ExtensionWorker();
    return {
        onmessage(message) {
            if (!isInitMessage(message)) {
                return; // silently ignore foreign messages
            }
            connectToRenderer(res.protocol).then(data => {
                performance.mark(`code/extHost/didWaitForInitData`);
                const extHostMain = new ExtensionHostMain(data.protocol, data.initData, hostUtil, null, message.data);
                patchFetching(uri => extHostMain.asBrowserUri(uri));
                onTerminate = (reason) => extHostMain.terminate(reason);
            });
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uSG9zdFdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL3dvcmtlci9leHRlbnNpb25Ib3N0V29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDeEQsT0FBTyxFQUFFLGVBQWUsRUFBZSxtQkFBbUIsRUFBMEIsTUFBTSwyREFBMkQsQ0FBQztBQUN0SixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVuRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDeEYsT0FBTyxLQUFLLElBQUksTUFBTSw4QkFBOEIsQ0FBQztBQUNyRCxPQUFPLEtBQUssV0FBVyxNQUFNLHFDQUFxQyxDQUFDO0FBRW5FLE9BQU8sc0NBQXNDLENBQUM7QUFDOUMsT0FBTyw4QkFBOEIsQ0FBQztBQUN0QyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDN0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBcUJsRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsMEJBQTBCLENBQUMsQ0FBQztBQUU3RCxNQUFNLGlCQUFpQixHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakQsSUFBSSxDQUFDLFdBQVcsR0FBRyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLGdDQUFnQyxD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