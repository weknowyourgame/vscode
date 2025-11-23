/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { onUnexpectedError, transformErrorForSerialization } from '../errors.js';
import { Emitter } from '../event.js';
import { Disposable } from '../lifecycle.js';
import { isWeb } from '../platform.js';
import * as strings from '../strings.js';
const DEFAULT_CHANNEL = 'default';
const INITIALIZE = '$initialize';
let webWorkerWarningLogged = false;
export function logOnceWebWorkerWarning(err) {
    if (!isWeb) {
        // running tests
        return;
    }
    if (!webWorkerWarningLogged) {
        webWorkerWarningLogged = true;
        console.warn('Could not create web worker(s). Falling back to loading web worker code in main thread, which might cause UI freezes. Please see https://github.com/microsoft/monaco-editor#faq');
    }
    console.warn(err.message);
}
var MessageType;
(function (MessageType) {
    MessageType[MessageType["Request"] = 0] = "Request";
    MessageType[MessageType["Reply"] = 1] = "Reply";
    MessageType[MessageType["SubscribeEvent"] = 2] = "SubscribeEvent";
    MessageType[MessageType["Event"] = 3] = "Event";
    MessageType[MessageType["UnsubscribeEvent"] = 4] = "UnsubscribeEvent";
})(MessageType || (MessageType = {}));
class RequestMessage {
    constructor(vsWorker, req, channel, method, args) {
        this.vsWorker = vsWorker;
        this.req = req;
        this.channel = channel;
        this.method = method;
        this.args = args;
        this.type = 0 /* MessageType.Request */;
    }
}
class ReplyMessage {
    constructor(vsWorker, seq, res, err) {
        this.vsWorker = vsWorker;
        this.seq = seq;
        this.res = res;
        this.err = err;
        this.type = 1 /* MessageType.Reply */;
    }
}
class SubscribeEventMessage {
    constructor(vsWorker, req, channel, eventName, arg) {
        this.vsWorker = vsWorker;
        this.req = req;
        this.channel = channel;
        this.eventName = eventName;
        this.arg = arg;
        this.type = 2 /* MessageType.SubscribeEvent */;
    }
}
class EventMessage {
    constructor(vsWorker, req, event) {
        this.vsWorker = vsWorker;
        this.req = req;
        this.event = event;
        this.type = 3 /* MessageType.Event */;
    }
}
class UnsubscribeEventMessage {
    constructor(vsWorker, req) {
        this.vsWorker = vsWorker;
        this.req = req;
        this.type = 4 /* MessageType.UnsubscribeEvent */;
    }
}
class WebWorkerProtocol {
    constructor(handler) {
        this._workerId = -1;
        this._handler = handler;
        this._lastSentReq = 0;
        this._pendingReplies = Object.create(null);
        this._pendingEmitters = new Map();
        this._pendingEvents = new Map();
    }
    setWorkerId(workerId) {
        this._workerId = workerId;
    }
    async sendMessage(channel, method, args) {
        const req = String(++this._lastSentReq);
        return new Promise((resolve, reject) => {
            this._pendingReplies[req] = {
                resolve: resolve,
                reject: reject
            };
            this._send(new RequestMessage(this._workerId, req, channel, method, args));
        });
    }
    listen(channel, eventName, arg) {
        let req = null;
        const emitter = new Emitter({
            onWillAddFirstListener: () => {
                req = String(++this._lastSentReq);
                this._pendingEmitters.set(req, emitter);
                this._send(new SubscribeEventMessage(this._workerId, req, channel, eventName, arg));
            },
            onDidRemoveLastListener: () => {
                this._pendingEmitters.delete(req);
                this._send(new UnsubscribeEventMessage(this._workerId, req));
                req = null;
            }
        });
        return emitter.event;
    }
    handleMessage(message) {
        if (!message || !message.vsWorker) {
            return;
        }
        if (this._workerId !== -1 && message.vsWorker !== this._workerId) {
            return;
        }
        this._handleMessage(message);
    }
    createProxyToRemoteChannel(channel, sendMessageBarrier) {
        const handler = {
            get: (target, name) => {
                if (typeof name === 'string' && !target[name]) {
                    if (propertyIsDynamicEvent(name)) { // onDynamic...
                        target[name] = (arg) => {
                            return this.listen(channel, name, arg);
                        };
                    }
                    else if (propertyIsEvent(name)) { // on...
                        target[name] = this.listen(channel, name, undefined);
                    }
                    else if (name.charCodeAt(0) === 36 /* CharCode.DollarSign */) { // $...
                        target[name] = async (...myArgs) => {
                            await sendMessageBarrier?.();
                            return this.sendMessage(channel, name, myArgs);
                        };
                    }
                }
                return target[name];
            }
        };
        return new Proxy(Object.create(null), handler);
    }
    _handleMessage(msg) {
        switch (msg.type) {
            case 1 /* MessageType.Reply */:
                return this._handleReplyMessage(msg);
            case 0 /* MessageType.Request */:
                return this._handleRequestMessage(msg);
            case 2 /* MessageType.SubscribeEvent */:
                return this._handleSubscribeEventMessage(msg);
            case 3 /* MessageType.Event */:
                return this._handleEventMessage(msg);
            case 4 /* MessageType.UnsubscribeEvent */:
                return this._handleUnsubscribeEventMessage(msg);
        }
    }
    _handleReplyMessage(replyMessage) {
        if (!this._pendingReplies[replyMessage.seq]) {
            console.warn('Got reply to unknown seq');
            return;
        }
        const reply = this._pendingReplies[replyMessage.seq];
        delete this._pendingReplies[replyMessage.seq];
        if (replyMessage.err) {
            let err = replyMessage.err;
            if (replyMessage.err.$isError) {
                const newErr = new Error();
                newErr.name = replyMessage.err.name;
                newErr.message = replyMessage.err.message;
                newErr.stack = replyMessage.err.stack;
                err = newErr;
            }
            reply.reject(err);
            return;
        }
        reply.resolve(replyMessage.res);
    }
    _handleRequestMessage(requestMessage) {
        const req = requestMessage.req;
        const result = this._handler.handleMessage(requestMessage.channel, requestMessage.method, requestMessage.args);
        result.then((r) => {
            this._send(new ReplyMessage(this._workerId, req, r, undefined));
        }, (e) => {
            if (e.detail instanceof Error) {
                // Loading errors have a detail property that points to the actual error
                e.detail = transformErrorForSerialization(e.detail);
            }
            this._send(new ReplyMessage(this._workerId, req, undefined, transformErrorForSerialization(e)));
        });
    }
    _handleSubscribeEventMessage(msg) {
        const req = msg.req;
        const disposable = this._handler.handleEvent(msg.channel, msg.eventName, msg.arg)((event) => {
            this._send(new EventMessage(this._workerId, req, event));
        });
        this._pendingEvents.set(req, disposable);
    }
    _handleEventMessage(msg) {
        const emitter = this._pendingEmitters.get(msg.req);
        if (emitter === undefined) {
            console.warn('Got event for unknown req');
            return;
        }
        emitter.fire(msg.event);
    }
    _handleUnsubscribeEventMessage(msg) {
        const event = this._pendingEvents.get(msg.req);
        if (event === undefined) {
            console.warn('Got unsubscribe for unknown req');
            return;
        }
        event.dispose();
        this._pendingEvents.delete(msg.req);
    }
    _send(msg) {
        const transfer = [];
        if (msg.type === 0 /* MessageType.Request */) {
            for (let i = 0; i < msg.args.length; i++) {
                const arg = msg.args[i];
                if (arg instanceof ArrayBuffer) {
                    transfer.push(arg);
                }
            }
        }
        else if (msg.type === 1 /* MessageType.Reply */) {
            if (msg.res instanceof ArrayBuffer) {
                transfer.push(msg.res);
            }
        }
        this._handler.sendMessage(msg, transfer);
    }
}
/**
 * Main thread side
 */
export class WebWorkerClient extends Disposable {
    constructor(worker) {
        super();
        this._localChannels = new Map();
        this._remoteChannels = new Map();
        this._worker = this._register(worker);
        this._register(this._worker.onMessage((msg) => {
            this._protocol.handleMessage(msg);
        }));
        this._register(this._worker.onError((err) => {
            logOnceWebWorkerWarning(err);
            onUnexpectedError(err);
        }));
        this._protocol = new WebWorkerProtocol({
            sendMessage: (msg, transfer) => {
                this._worker.postMessage(msg, transfer);
            },
            handleMessage: (channel, method, args) => {
                return this._handleMessage(channel, method, args);
            },
            handleEvent: (channel, eventName, arg) => {
                return this._handleEvent(channel, eventName, arg);
            }
        });
        this._protocol.setWorkerId(this._worker.getId());
        // Send initialize message
        this._onModuleLoaded = this._protocol.sendMessage(DEFAULT_CHANNEL, INITIALIZE, [
            this._worker.getId(),
        ]).then(() => { });
        this.proxy = this._protocol.createProxyToRemoteChannel(DEFAULT_CHANNEL, async () => { await this._onModuleLoaded; });
        this._onModuleLoaded.catch((e) => {
            this._onError('Worker failed to load ', e);
        });
    }
    _handleMessage(channelName, method, args) {
        const channel = this._localChannels.get(channelName);
        if (!channel) {
            return Promise.reject(new Error(`Missing channel ${channelName} on main thread`));
        }
        const fn = channel[method];
        if (typeof fn !== 'function') {
            return Promise.reject(new Error(`Missing method ${method} on main thread channel ${channelName}`));
        }
        try {
            return Promise.resolve(fn.apply(channel, args));
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    _handleEvent(channelName, eventName, arg) {
        const channel = this._localChannels.get(channelName);
        if (!channel) {
            throw new Error(`Missing channel ${channelName} on main thread`);
        }
        if (propertyIsDynamicEvent(eventName)) {
            const fn = channel[eventName];
            if (typeof fn !== 'function') {
                throw new Error(`Missing dynamic event ${eventName} on main thread channel ${channelName}.`);
            }
            const event = fn.call(channel, arg);
            if (typeof event !== 'function') {
                throw new Error(`Missing dynamic event ${eventName} on main thread channel ${channelName}.`);
            }
            return event;
        }
        if (propertyIsEvent(eventName)) {
            const event = channel[eventName];
            if (typeof event !== 'function') {
                throw new Error(`Missing event ${eventName} on main thread channel ${channelName}.`);
            }
            return event;
        }
        throw new Error(`Malformed event name ${eventName}`);
    }
    setChannel(channel, handler) {
        this._localChannels.set(channel, handler);
    }
    getChannel(channel) {
        let inst = this._remoteChannels.get(channel);
        if (inst === undefined) {
            inst = this._protocol.createProxyToRemoteChannel(channel, async () => { await this._onModuleLoaded; });
            this._remoteChannels.set(channel, inst);
        }
        return inst;
    }
    _onError(message, error) {
        console.error(message);
        console.info(error);
    }
}
function propertyIsEvent(name) {
    // Assume a property is an event if it has a form of "onSomething"
    return name[0] === 'o' && name[1] === 'n' && strings.isUpperAsciiLetter(name.charCodeAt(2));
}
function propertyIsDynamicEvent(name) {
    // Assume a property is a dynamic event (a method that returns an event) if it has a form of "onDynamicSomething"
    return /^onDynamic/.test(name) && strings.isUpperAsciiLetter(name.charCodeAt(9));
}
/**
 * Worker side
 */
export class WebWorkerServer {
    constructor(postMessage, requestHandlerFactory) {
        this._localChannels = new Map();
        this._remoteChannels = new Map();
        this._protocol = new WebWorkerProtocol({
            sendMessage: (msg, transfer) => {
                postMessage(msg, transfer);
            },
            handleMessage: (channel, method, args) => this._handleMessage(channel, method, args),
            handleEvent: (channel, eventName, arg) => this._handleEvent(channel, eventName, arg)
        });
        this.requestHandler = requestHandlerFactory(this);
    }
    onmessage(msg) {
        this._protocol.handleMessage(msg);
    }
    _handleMessage(channel, method, args) {
        if (channel === DEFAULT_CHANNEL && method === INITIALIZE) {
            return this.initialize(args[0]);
        }
        const requestHandler = (channel === DEFAULT_CHANNEL ? this.requestHandler : this._localChannels.get(channel));
        if (!requestHandler) {
            return Promise.reject(new Error(`Missing channel ${channel} on worker thread`));
        }
        const fn = requestHandler[method];
        if (typeof fn !== 'function') {
            return Promise.reject(new Error(`Missing method ${method} on worker thread channel ${channel}`));
        }
        try {
            return Promise.resolve(fn.apply(requestHandler, args));
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    _handleEvent(channel, eventName, arg) {
        const requestHandler = (channel === DEFAULT_CHANNEL ? this.requestHandler : this._localChannels.get(channel));
        if (!requestHandler) {
            throw new Error(`Missing channel ${channel} on worker thread`);
        }
        if (propertyIsDynamicEvent(eventName)) {
            const fn = requestHandler[eventName];
            if (typeof fn !== 'function') {
                throw new Error(`Missing dynamic event ${eventName} on request handler.`);
            }
            const event = fn.call(requestHandler, arg);
            if (typeof event !== 'function') {
                throw new Error(`Missing dynamic event ${eventName} on request handler.`);
            }
            return event;
        }
        if (propertyIsEvent(eventName)) {
            const event = requestHandler[eventName];
            if (typeof event !== 'function') {
                throw new Error(`Missing event ${eventName} on request handler.`);
            }
            return event;
        }
        throw new Error(`Malformed event name ${eventName}`);
    }
    setChannel(channel, handler) {
        this._localChannels.set(channel, handler);
    }
    getChannel(channel) {
        let inst = this._remoteChannels.get(channel);
        if (inst === undefined) {
            inst = this._protocol.createProxyToRemoteChannel(channel);
            this._remoteChannels.set(channel, inst);
        }
        return inst;
    }
    async initialize(workerId) {
        this._protocol.setWorkerId(workerId);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViV29ya2VyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL3dvcmtlci93ZWJXb3JrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFtQiw4QkFBOEIsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUNsRyxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sYUFBYSxDQUFDO0FBQzdDLE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSxpQkFBaUIsQ0FBQztBQUMxRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDdkMsT0FBTyxLQUFLLE9BQU8sTUFBTSxlQUFlLENBQUM7QUFFekMsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDO0FBQ2xDLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQztBQVNqQyxJQUFJLHNCQUFzQixHQUFHLEtBQUssQ0FBQztBQUNuQyxNQUFNLFVBQVUsdUJBQXVCLENBQUMsR0FBWTtJQUNuRCxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDWixnQkFBZ0I7UUFDaEIsT0FBTztJQUNSLENBQUM7SUFDRCxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUM3QixzQkFBc0IsR0FBRyxJQUFJLENBQUM7UUFDOUIsT0FBTyxDQUFDLElBQUksQ0FBQyxpTEFBaUwsQ0FBQyxDQUFDO0lBQ2pNLENBQUM7SUFDRCxPQUFPLENBQUMsSUFBSSxDQUFFLEdBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN0QyxDQUFDO0FBRUQsSUFBVyxXQU1WO0FBTkQsV0FBVyxXQUFXO0lBQ3JCLG1EQUFPLENBQUE7SUFDUCwrQ0FBSyxDQUFBO0lBQ0wsaUVBQWMsQ0FBQTtJQUNkLCtDQUFLLENBQUE7SUFDTCxxRUFBZ0IsQ0FBQTtBQUNqQixDQUFDLEVBTlUsV0FBVyxLQUFYLFdBQVcsUUFN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