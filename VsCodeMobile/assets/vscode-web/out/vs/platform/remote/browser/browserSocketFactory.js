/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../../base/browser/dom.js';
import { RunOnceScheduler } from '../../../base/common/async.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { SocketDiagnostics } from '../../../base/parts/ipc/common/ipc.net.js';
import { RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode } from '../common/remoteAuthorityResolver.js';
import { mainWindow } from '../../../base/browser/window.js';
class BrowserWebSocket extends Disposable {
    traceSocketEvent(type, data) {
        SocketDiagnostics.traceSocketEvent(this._socket, this._debugLabel, type, data);
    }
    constructor(url, debugLabel) {
        super();
        this._onData = new Emitter();
        this.onData = this._onData.event;
        this._onOpen = this._register(new Emitter());
        this.onOpen = this._onOpen.event;
        this._onClose = this._register(new Emitter());
        this.onClose = this._onClose.event;
        this._onError = this._register(new Emitter());
        this.onError = this._onError.event;
        this._debugLabel = debugLabel;
        this._socket = new WebSocket(url);
        this.traceSocketEvent("created" /* SocketDiagnosticsEventType.Created */, { type: 'BrowserWebSocket', url });
        this._fileReader = new FileReader();
        this._queue = [];
        this._isReading = false;
        this._isClosed = false;
        this._fileReader.onload = (event) => {
            this._isReading = false;
            // eslint-disable-next-line local/code-no-any-casts
            const buff = event.target.result;
            this.traceSocketEvent("read" /* SocketDiagnosticsEventType.Read */, buff);
            this._onData.fire(buff);
            if (this._queue.length > 0) {
                enqueue(this._queue.shift());
            }
        };
        const enqueue = (blob) => {
            if (this._isReading) {
                this._queue.push(blob);
                return;
            }
            this._isReading = true;
            this._fileReader.readAsArrayBuffer(blob);
        };
        this._socketMessageListener = (ev) => {
            const blob = ev.data;
            this.traceSocketEvent("browserWebSocketBlobReceived" /* SocketDiagnosticsEventType.BrowserWebSocketBlobReceived */, { type: blob.type, size: blob.size });
            enqueue(blob);
        };
        this._socket.addEventListener('message', this._socketMessageListener);
        this._register(dom.addDisposableListener(this._socket, 'open', (e) => {
            this.traceSocketEvent("open" /* SocketDiagnosticsEventType.Open */);
            this._onOpen.fire();
        }));
        // WebSockets emit error events that do not contain any real information
        // Our only chance of getting to the root cause of an error is to
        // listen to the close event which gives out some real information:
        // - https://www.w3.org/TR/websockets/#closeevent
        // - https://tools.ietf.org/html/rfc6455#section-11.7
        //
        // But the error event is emitted before the close event, so we therefore
        // delay the error event processing in the hope of receiving a close event
        // with more information
        let pendingErrorEvent = null;
        const sendPendingErrorNow = () => {
            const err = pendingErrorEvent;
            pendingErrorEvent = null;
            this._onError.fire(err);
        };
        const errorRunner = this._register(new RunOnceScheduler(sendPendingErrorNow, 0));
        const sendErrorSoon = (err) => {
            errorRunner.cancel();
            pendingErrorEvent = err;
            errorRunner.schedule();
        };
        const sendErrorNow = (err) => {
            errorRunner.cancel();
            pendingErrorEvent = err;
            sendPendingErrorNow();
        };
        this._register(dom.addDisposableListener(this._socket, 'close', (e) => {
            this.traceSocketEvent("close" /* SocketDiagnosticsEventType.Close */, { code: e.code, reason: e.reason, wasClean: e.wasClean });
            this._isClosed = true;
            if (pendingErrorEvent) {
                if (!navigator.onLine) {
                    // The browser is offline => this is a temporary error which might resolve itself
                    sendErrorNow(new RemoteAuthorityResolverError('Browser is offline', RemoteAuthorityResolverErrorCode.TemporarilyNotAvailable, e));
                }
                else {
                    // An error event is pending
                    // The browser appears to be online...
                    if (!e.wasClean) {
                        // Let's be optimistic and hope that perhaps the server could not be reached or something
                        sendErrorNow(new RemoteAuthorityResolverError(e.reason || `WebSocket close with status code ${e.code}`, RemoteAuthorityResolverErrorCode.TemporarilyNotAvailable, e));
                    }
                    else {
                        // this was a clean close => send existing error
                        errorRunner.cancel();
                        sendPendingErrorNow();
                    }
                }
            }
            this._onClose.fire({ code: e.code, reason: e.reason, wasClean: e.wasClean, event: e });
        }));
        this._register(dom.addDisposableListener(this._socket, 'error', (err) => {
            this.traceSocketEvent("error" /* SocketDiagnosticsEventType.Error */, { message: err?.message });
            sendErrorSoon(err);
        }));
    }
    send(data) {
        if (this._isClosed) {
            // Refuse to write data to closed WebSocket...
            return;
        }
        this.traceSocketEvent("write" /* SocketDiagnosticsEventType.Write */, data);
        this._socket.send(data);
    }
    close() {
        this._isClosed = true;
        this.traceSocketEvent("close" /* SocketDiagnosticsEventType.Close */);
        this._socket.close();
        this._socket.removeEventListener('message', this._socketMessageListener);
        this.dispose();
    }
}
const defaultWebSocketFactory = new class {
    create(url, debugLabel) {
        return new BrowserWebSocket(url, debugLabel);
    }
};
class BrowserSocket {
    traceSocketEvent(type, data) {
        if (typeof this.socket.traceSocketEvent === 'function') {
            this.socket.traceSocketEvent(type, data);
        }
        else {
            SocketDiagnostics.traceSocketEvent(this.socket, this.debugLabel, type, data);
        }
    }
    constructor(socket, debugLabel) {
        this.socket = socket;
        this.debugLabel = debugLabel;
    }
    dispose() {
        this.socket.close();
    }
    onData(listener) {
        return this.socket.onData((data) => listener(VSBuffer.wrap(new Uint8Array(data))));
    }
    onClose(listener) {
        const adapter = (e) => {
            if (typeof e === 'undefined') {
                listener(e);
            }
            else {
                listener({
                    type: 1 /* SocketCloseEventType.WebSocketCloseEvent */,
                    code: e.code,
                    reason: e.reason,
                    wasClean: e.wasClean,
                    event: e.event
                });
            }
        };
        return this.socket.onClose(adapter);
    }
    onEnd(listener) {
        return Disposable.None;
    }
    write(buffer) {
        this.socket.send(buffer.buffer);
    }
    end() {
        this.socket.close();
    }
    drain() {
        return Promise.resolve();
    }
}
export class BrowserSocketFactory {
    constructor(webSocketFactory) {
        this._webSocketFactory = webSocketFactory || defaultWebSocketFactory;
    }
    supports(connectTo) {
        return true;
    }
    connect({ host, port }, path, query, debugLabel) {
        return new Promise((resolve, reject) => {
            const webSocketSchema = (/^https:/.test(mainWindow.location.href) ? 'wss' : 'ws');
            const socket = this._webSocketFactory.create(`${webSocketSchema}://${(/:/.test(host) && !/\[/.test(host)) ? `[${host}]` : host}:${port}${path}?${query}&skipWebSocketFrames=false`, debugLabel);
            const disposables = new DisposableStore();
            disposables.add(socket.onError(reject));
            disposables.add(socket.onOpen(() => {
                disposables.dispose();
                resolve(new BrowserSocket(socket, debugLabel));
            }));
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3NlclNvY2tldEZhY3RvcnkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcmVtb3RlL2Jyb3dzZXIvYnJvd3NlclNvY2tldEZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSw4QkFBOEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLE1BQU0sbUNBQW1DLENBQUM7QUFDN0YsT0FBTyxFQUFtRCxpQkFBaUIsRUFBOEIsTUFBTSwyQ0FBMkMsQ0FBQztBQUUzSixPQUFPLEVBQUUsNEJBQTRCLEVBQUUsZ0NBQWdDLEVBQW1ELE1BQU0sc0NBQXNDLENBQUM7QUFDdkssT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBb0M3RCxNQUFNLGdCQUFpQixTQUFRLFVBQVU7SUF1QmpDLGdCQUFnQixDQUFDLElBQWdDLEVBQUUsSUFBa0U7UUFDM0gsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNoRixDQUFDO0lBRUQsWUFBWSxHQUFXLEVBQUUsVUFBa0I7UUFDMUMsS0FBSyxFQUFFLENBQUM7UUExQlEsWUFBTyxHQUFHLElBQUksT0FBTyxFQUFlLENBQUM7UUFDdEMsV0FBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBRTNCLFlBQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFD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