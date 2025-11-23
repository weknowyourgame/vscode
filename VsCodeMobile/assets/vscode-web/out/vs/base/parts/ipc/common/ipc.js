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
import { getRandomElement } from '../../../common/arrays.js';
import { createCancelablePromise, timeout } from '../../../common/async.js';
import { VSBuffer } from '../../../common/buffer.js';
import { CancellationToken, CancellationTokenSource } from '../../../common/cancellation.js';
import { memoize } from '../../../common/decorators.js';
import { CancellationError, ErrorNoTelemetry } from '../../../common/errors.js';
import { Emitter, Event, EventMultiplexer, Relay } from '../../../common/event.js';
import { createSingleCallFunction } from '../../../common/functional.js';
import { DisposableStore, dispose, toDisposable } from '../../../common/lifecycle.js';
import { revive } from '../../../common/marshalling.js';
import * as strings from '../../../common/strings.js';
import { isFunction, isUndefinedOrNull } from '../../../common/types.js';
var RequestType;
(function (RequestType) {
    RequestType[RequestType["Promise"] = 100] = "Promise";
    RequestType[RequestType["PromiseCancel"] = 101] = "PromiseCancel";
    RequestType[RequestType["EventListen"] = 102] = "EventListen";
    RequestType[RequestType["EventDispose"] = 103] = "EventDispose";
})(RequestType || (RequestType = {}));
function requestTypeToStr(type) {
    switch (type) {
        case 100 /* RequestType.Promise */:
            return 'req';
        case 101 /* RequestType.PromiseCancel */:
            return 'cancel';
        case 102 /* RequestType.EventListen */:
            return 'subscribe';
        case 103 /* RequestType.EventDispose */:
            return 'unsubscribe';
    }
}
var ResponseType;
(function (ResponseType) {
    ResponseType[ResponseType["Initialize"] = 200] = "Initialize";
    ResponseType[ResponseType["PromiseSuccess"] = 201] = "PromiseSuccess";
    ResponseType[ResponseType["PromiseError"] = 202] = "PromiseError";
    ResponseType[ResponseType["PromiseErrorObj"] = 203] = "PromiseErrorObj";
    ResponseType[ResponseType["EventFire"] = 204] = "EventFire";
})(ResponseType || (ResponseType = {}));
function responseTypeToStr(type) {
    switch (type) {
        case 200 /* ResponseType.Initialize */:
            return `init`;
        case 201 /* ResponseType.PromiseSuccess */:
            return `reply:`;
        case 202 /* ResponseType.PromiseError */:
        case 203 /* ResponseType.PromiseErrorObj */:
            return `replyErr:`;
        case 204 /* ResponseType.EventFire */:
            return `event:`;
    }
}
var State;
(function (State) {
    State[State["Uninitialized"] = 0] = "Uninitialized";
    State[State["Idle"] = 1] = "Idle";
})(State || (State = {}));
/**
 * @see https://en.wikipedia.org/wiki/Variable-length_quantity
 */
function readIntVQL(reader) {
    let value = 0;
    for (let n = 0;; n += 7) {
        const next = reader.read(1);
        value |= (next.buffer[0] & 0b01111111) << n;
        if (!(next.buffer[0] & 0b10000000)) {
            return value;
        }
    }
}
const vqlZero = createOneByteBuffer(0);
/**
 * @see https://en.wikipedia.org/wiki/Variable-length_quantity
 */
function writeInt32VQL(writer, value) {
    if (value === 0) {
        writer.write(vqlZero);
        return;
    }
    let len = 0;
    for (let v2 = value; v2 !== 0; v2 = v2 >>> 7) {
        len++;
    }
    const scratch = VSBuffer.alloc(len);
    for (let i = 0; value !== 0; i++) {
        scratch.buffer[i] = value & 0b01111111;
        value = value >>> 7;
        if (value > 0) {
            scratch.buffer[i] |= 0b10000000;
        }
    }
    writer.write(scratch);
}
export class BufferReader {
    constructor(buffer) {
        this.buffer = buffer;
        this.pos = 0;
    }
    read(bytes) {
        const result = this.buffer.slice(this.pos, this.pos + bytes);
        this.pos += result.byteLength;
        return result;
    }
}
export class BufferWriter {
    constructor() {
        this.buffers = [];
    }
    get buffer() {
        return VSBuffer.concat(this.buffers);
    }
    write(buffer) {
        this.buffers.push(buffer);
    }
}
var DataType;
(function (DataType) {
    DataType[DataType["Undefined"] = 0] = "Undefined";
    DataType[DataType["String"] = 1] = "String";
    DataType[DataType["Buffer"] = 2] = "Buffer";
    DataType[DataType["VSBuffer"] = 3] = "VSBuffer";
    DataType[DataType["Array"] = 4] = "Array";
    DataType[DataType["Object"] = 5] = "Object";
    DataType[DataType["Int"] = 6] = "Int";
})(DataType || (DataType = {}));
function createOneByteBuffer(value) {
    const result = VSBuffer.alloc(1);
    result.writeUInt8(value, 0);
    return result;
}
const BufferPresets = {
    Undefined: createOneByteBuffer(DataType.Undefined),
    String: createOneByteBuffer(DataType.String),
    Buffer: createOneByteBuffer(DataType.Buffer),
    VSBuffer: createOneByteBuffer(DataType.VSBuffer),
    Array: createOneByteBuffer(DataType.Array),
    Object: createOneByteBuffer(DataType.Object),
    Uint: createOneByteBuffer(DataType.Int),
};
export function serialize(writer, data) {
    if (typeof data === 'undefined') {
        writer.write(BufferPresets.Undefined);
    }
    else if (typeof data === 'string') {
        const buffer = VSBuffer.fromString(data);
        writer.write(BufferPresets.String);
        writeInt32VQL(writer, buffer.byteLength);
        writer.write(buffer);
    }
    else if (VSBuffer.isNativeBuffer(data)) {
        const buffer = VSBuffer.wrap(data);
        writer.write(BufferPresets.Buffer);
        writeInt32VQL(writer, buffer.byteLength);
        writer.write(buffer);
    }
    else if (data instanceof VSBuffer) {
        writer.write(BufferPresets.VSBuffer);
        writeInt32VQL(writer, data.byteLength);
        writer.write(data);
    }
    else if (Array.isArray(data)) {
        writer.write(BufferPresets.Array);
        writeInt32VQL(writer, data.length);
        for (const el of data) {
            serialize(writer, el);
        }
    }
    else if (typeof data === 'number' && (data | 0) === data) {
        // write a vql if it's a number that we can do bitwise operations on
        writer.write(BufferPresets.Uint);
        writeInt32VQL(writer, data);
    }
    else {
        const buffer = VSBuffer.fromString(JSON.stringify(data));
        writer.write(BufferPresets.Object);
        writeInt32VQL(writer, buffer.byteLength);
        writer.write(buffer);
    }
}
export function deserialize(reader) {
    const type = reader.read(1).readUInt8(0);
    switch (type) {
        case DataType.Undefined: return undefined;
        case DataType.String: return reader.read(readIntVQL(reader)).toString();
        case DataType.Buffer: return reader.read(readIntVQL(reader)).buffer;
        case DataType.VSBuffer: return reader.read(readIntVQL(reader));
        case DataType.Array: {
            const length = readIntVQL(reader);
            const result = [];
            for (let i = 0; i < length; i++) {
                result.push(deserialize(reader));
            }
            return result;
        }
        case DataType.Object: return JSON.parse(reader.read(readIntVQL(reader)).toString());
        case DataType.Int: return readIntVQL(reader);
    }
}
export class ChannelServer {
    constructor(protocol, ctx, logger = null, timeoutDelay = 1000) {
        this.protocol = protocol;
        this.ctx = ctx;
        this.logger = logger;
        this.timeoutDelay = timeoutDelay;
        this.channels = new Map();
        this.activeRequests = new Map();
        // Requests might come in for channels which are not yet registered.
        // They will timeout after `timeoutDelay`.
        this.pendingRequests = new Map();
        this.protocolListener = this.protocol.onMessage(msg => this.onRawMessage(msg));
        this.sendResponse({ type: 200 /* ResponseType.Initialize */ });
    }
    registerChannel(channelName, channel) {
        this.channels.set(channelName, channel);
        // https://github.com/microsoft/vscode/issues/72531
        setTimeout(() => this.flushPendingRequests(channelName), 0);
    }
    sendResponse(response) {
        switch (response.type) {
            case 200 /* ResponseType.Initialize */: {
                const msgLength = this.send([response.type]);
                this.logger?.logOutgoing(msgLength, 0, 1 /* RequestInitiator.OtherSide */, responseTypeToStr(response.type));
                return;
            }
            case 201 /* ResponseType.PromiseSuccess */:
            case 202 /* ResponseType.PromiseError */:
            case 204 /* ResponseType.EventFire */:
            case 203 /* ResponseType.PromiseErrorObj */: {
                const msgLength = this.send([response.type, response.id], response.data);
                this.logger?.logOutgoing(msgLength, response.id, 1 /* RequestInitiator.OtherSide */, responseTypeToStr(response.type), response.data);
                return;
            }
        }
    }
    send(header, body = undefined) {
        const writer = new BufferWriter();
        serialize(writer, header);
        serialize(writer, body);
        return this.sendBuffer(writer.buffer);
    }
    sendBuffer(message) {
        try {
            this.protocol.send(message);
            return message.byteLength;
        }
        catch (err) {
            // noop
            return 0;
        }
    }
    onRawMessage(message) {
        const reader = new BufferReader(message);
        const header = deserialize(reader);
        const body = deserialize(reader);
        const type = header[0];
        switch (type) {
            case 100 /* RequestType.Promise */:
                this.logger?.logIncoming(message.byteLength, header[1], 1 /* RequestInitiator.OtherSide */, `${requestTypeToStr(type)}: ${header[2]}.${header[3]}`, body);
                return this.onPromise({ type, id: header[1], channelName: header[2], name: header[3], arg: body });
            case 102 /* RequestType.EventListen */:
                this.logger?.logIncoming(message.byteLength, header[1], 1 /* RequestInitiator.OtherSide */, `${requestTypeToStr(type)}: ${header[2]}.${header[3]}`, body);
                return this.onEventListen({ type, id: header[1], channelName: header[2], name: header[3], arg: body });
            case 101 /* RequestType.PromiseCancel */:
                this.logger?.logIncoming(message.byteLength, header[1], 1 /* RequestInitiator.OtherSide */, `${requestTypeToStr(type)}`);
                return this.disposeActiveRequest({ type, id: header[1] });
            case 103 /* RequestType.EventDispose */:
                this.logger?.logIncoming(message.byteLength, header[1], 1 /* RequestInitiator.OtherSide */, `${requestTypeToStr(type)}`);
                return this.disposeActiveRequest({ type, id: header[1] });
        }
    }
    onPromise(request) {
        const channel = this.channels.get(request.channelName);
        if (!channel) {
            this.collectPendingRequest(request);
            return;
        }
        const cancellationTokenSource = new CancellationTokenSource();
        let promise;
        try {
            promise = channel.call(this.ctx, request.name, request.arg, cancellationTokenSource.token);
        }
        catch (err) {
            promise = Promise.reject(err);
        }
        const id = request.id;
        promise.then(data => {
            this.sendResponse({ id, data, type: 201 /* ResponseType.PromiseSuccess */ });
        }, err => {
            if (err instanceof Error) {
                this.sendResponse({
                    id, data: {
                        message: err.message,
                        name: err.name,
                        stack: err.stack ? err.stack.split('\n') : undefined
                    }, type: 202 /* ResponseType.PromiseError */
                });
            }
            else {
                this.sendResponse({ id, data: err, type: 203 /* ResponseType.PromiseErrorObj */ });
            }
        }).finally(() => {
            disposable.dispose();
            this.activeRequests.delete(request.id);
        });
        const disposable = toDisposable(() => cancellationTokenSource.cancel());
        this.activeRequests.set(request.id, disposable);
    }
    onEventListen(request) {
        const channel = this.channels.get(request.channelName);
        if (!channel) {
            this.collectPendingRequest(request);
            return;
        }
        const id = request.id;
        const event = channel.listen(this.ctx, request.name, request.arg);
        const disposable = event(data => this.sendResponse({ id, data, type: 204 /* ResponseType.EventFire */ }));
        this.activeRequests.set(request.id, disposable);
    }
    disposeActiveRequest(request) {
        const disposable = this.activeRequests.get(request.id);
        if (disposable) {
            disposable.dispose();
            this.activeRequests.delete(request.id);
        }
    }
    collectPendingRequest(request) {
        let pendingRequests = this.pendingRequests.get(request.channelName);
        if (!pendingRequests) {
            pendingRequests = [];
            this.pendingRequests.set(request.channelName, pendingRequests);
        }
        const timer = setTimeout(() => {
            console.error(`Unknown channel: ${request.channelName}`);
            if (request.type === 100 /* RequestType.Promise */) {
                this.sendResponse({
                    id: request.id,
                    data: { name: 'Unknown channel', message: `Channel name '${request.channelName}' timed out after ${this.timeoutDelay}ms`, stack: undefined },
                    type: 202 /* ResponseType.PromiseError */
                });
            }
        }, this.timeoutDelay);
        pendingRequests.push({ request, timeoutTimer: timer });
    }
    flushPendingRequests(channelName) {
        const requests = this.pendingRequests.get(channelName);
        if (requests) {
            for (const request of requests) {
                clearTimeout(request.timeoutTimer);
                switch (request.request.type) {
                    case 100 /* RequestType.Promise */:
                        this.onPromise(request.request);
                        break;
                    case 102 /* RequestType.EventListen */:
                        this.onEventListen(request.request);
                        break;
                }
            }
            this.pendingRequests.delete(channelName);
        }
    }
    dispose() {
        if (this.protocolListener) {
            this.protocolListener.dispose();
            this.protocolListener = null;
        }
        dispose(this.activeRequests.values());
        this.activeRequests.clear();
    }
}
export var RequestInitiator;
(function (RequestInitiator) {
    RequestInitiator[RequestInitiator["LocalSide"] = 0] = "LocalSide";
    RequestInitiator[RequestInitiator["OtherSide"] = 1] = "OtherSide";
})(RequestInitiator || (RequestInitiator = {}));
export class ChannelClient {
    constructor(protocol, logger = null) {
        this.protocol = protocol;
        this.isDisposed = false;
        this.state = State.Uninitialized;
        this.activeRequests = new Set();
        this.handlers = new Map();
        this.lastRequestId = 0;
        this._onDidInitialize = new Emitter();
        this.onDidInitialize = this._onDidInitialize.event;
        this.protocolListener = this.protocol.onMessage(msg => this.onBuffer(msg));
        this.logger = logger;
    }
    getChannel(channelName) {
        const that = this;
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        return {
            call(command, arg, cancellationToken) {
                if (that.isDisposed) {
                    return Promise.reject(new CancellationError());
                }
                return that.requestPromise(channelName, command, arg, cancellationToken);
            },
            listen(event, arg) {
                if (that.isDisposed) {
                    return Event.None;
                }
                return that.requestEvent(channelName, event, arg);
            }
        };
    }
    requestPromise(channelName, name, arg, cancellationToken = CancellationToken.None) {
        const id = this.lastRequestId++;
        const type = 100 /* RequestType.Promise */;
        const request = { id, type, channelName, name, arg };
        if (cancellationToken.isCancellationRequested) {
            return Promise.reject(new CancellationError());
        }
        let disposable;
        let disposableWithRequestCancel;
        const result = new Promise((c, e) => {
            if (cancellationToken.isCancellationRequested) {
                return e(new CancellationError());
            }
            const doRequest = () => {
                const handler = response => {
                    switch (response.type) {
                        case 201 /* ResponseType.PromiseSuccess */:
                            this.handlers.delete(id);
                            c(response.data);
                            break;
                        case 202 /* ResponseType.PromiseError */: {
                            this.handlers.delete(id);
                            const error = new Error(response.data.message);
                            error.stack = Array.isArray(response.data.stack) ? response.data.stack.join('\n') : response.data.stack;
                            error.name = response.data.name;
                            e(error);
                            break;
                        }
                        case 203 /* ResponseType.PromiseErrorObj */:
                            this.handlers.delete(id);
                            e(response.data);
                            break;
                    }
                };
                this.handlers.set(id, handler);
                this.sendRequest(request);
            };
            let uninitializedPromise = null;
            if (this.state === State.Idle) {
                doRequest();
            }
            else {
                uninitializedPromise = createCancelablePromise(_ => this.whenInitialized());
                uninitializedPromise.then(() => {
                    uninitializedPromise = null;
                    doRequest();
                });
            }
            const cancel = () => {
                if (uninitializedPromise) {
                    uninitializedPromise.cancel();
                    uninitializedPromise = null;
                }
                else {
                    this.sendRequest({ id, type: 101 /* RequestType.PromiseCancel */ });
                }
                e(new CancellationError());
            };
            disposable = cancellationToken.onCancellationRequested(cancel);
            disposableWithRequestCancel = {
                dispose: createSingleCallFunction(() => {
                    cancel();
                    disposable.dispose();
                })
            };
            this.activeRequests.add(disposableWithRequestCancel);
        });
        return result.finally(() => {
            disposable?.dispose(); // Seen as undefined in tests.
            this.activeRequests.delete(disposableWithRequestCancel);
        });
    }
    requestEvent(channelName, name, arg) {
        const id = this.lastRequestId++;
        const type = 102 /* RequestType.EventListen */;
        const request = { id, type, channelName, name, arg };
        let uninitializedPromise = null;
        const emitter = new Emitter({
            onWillAddFirstListener: () => {
                const doRequest = () => {
                    this.activeRequests.add(emitter);
                    this.sendRequest(request);
                };
                if (this.state === State.Idle) {
                    doRequest();
                }
                else {
                    uninitializedPromise = createCancelablePromise(_ => this.whenInitialized());
                    uninitializedPromise.then(() => {
                        uninitializedPromise = null;
                        doRequest();
                    });
                }
            },
            onDidRemoveLastListener: () => {
                if (uninitializedPromise) {
                    uninitializedPromise.cancel();
                    uninitializedPromise = null;
                }
                else {
                    this.activeRequests.delete(emitter);
                    this.sendRequest({ id, type: 103 /* RequestType.EventDispose */ });
                }
            }
        });
        const handler = (res) => emitter.fire(res.data);
        this.handlers.set(id, handler);
        return emitter.event;
    }
    sendRequest(request) {
        switch (request.type) {
            case 100 /* RequestType.Promise */:
            case 102 /* RequestType.EventListen */: {
                const msgLength = this.send([request.type, request.id, request.channelName, request.name], request.arg);
                this.logger?.logOutgoing(msgLength, request.id, 0 /* RequestInitiator.LocalSide */, `${requestTypeToStr(request.type)}: ${request.channelName}.${request.name}`, request.arg);
                return;
            }
            case 101 /* RequestType.PromiseCancel */:
            case 103 /* RequestType.EventDispose */: {
                const msgLength = this.send([request.type, request.id]);
                this.logger?.logOutgoing(msgLength, request.id, 0 /* RequestInitiator.LocalSide */, requestTypeToStr(request.type));
                return;
            }
        }
    }
    send(header, body = undefined) {
        const writer = new BufferWriter();
        serialize(writer, header);
        serialize(writer, body);
        return this.sendBuffer(writer.buffer);
    }
    sendBuffer(message) {
        try {
            this.protocol.send(message);
            return message.byteLength;
        }
        catch (err) {
            // noop
            return 0;
        }
    }
    onBuffer(message) {
        const reader = new BufferReader(message);
        const header = deserialize(reader);
        const body = deserialize(reader);
        const type = header[0];
        switch (type) {
            case 200 /* ResponseType.Initialize */:
                this.logger?.logIncoming(message.byteLength, 0, 0 /* RequestInitiator.LocalSide */, responseTypeToStr(type));
                return this.onResponse({ type: header[0] });
            case 201 /* ResponseType.PromiseSuccess */:
            case 202 /* ResponseType.PromiseError */:
            case 204 /* ResponseType.EventFire */:
            case 203 /* ResponseType.PromiseErrorObj */:
                this.logger?.logIncoming(message.byteLength, header[1], 0 /* RequestInitiator.LocalSide */, responseTypeToStr(type), body);
                return this.onResponse({ type: header[0], id: header[1], data: body });
        }
    }
    onResponse(response) {
        if (response.type === 200 /* ResponseType.Initialize */) {
            this.state = State.Idle;
            this._onDidInitialize.fire();
            return;
        }
        const handler = this.handlers.get(response.id);
        handler?.(response);
    }
    get onDidInitializePromise() {
        return Event.toPromise(this.onDidInitialize);
    }
    whenInitialized() {
        if (this.state === State.Idle) {
            return Promise.resolve();
        }
        else {
            return this.onDidInitializePromise;
        }
    }
    dispose() {
        this.isDisposed = true;
        if (this.protocolListener) {
            this.protocolListener.dispose();
            this.protocolListener = null;
        }
        dispose(this.activeRequests.values());
        this.activeRequests.clear();
    }
}
__decorate([
    memoize
], ChannelClient.prototype, "onDidInitializePromise", null);
/**
 * An `IPCServer` is both a channel server and a routing channel
 * client.
 *
 * As the owner of a protocol, you should extend both this
 * and the `IPCClient` classes to get IPC implementations
 * for your protocol.
 */
export class IPCServer {
    get connections() {
        const result = [];
        this._connections.forEach(ctx => result.push(ctx));
        return result;
    }
    constructor(onDidClientConnect, ipcLogger, timeoutDelay) {
        this.channels = new Map();
        this._connections = new Set();
        this._onDidAddConnection = new Emitter();
        this.onDidAddConnection = this._onDidAddConnection.event;
        this._onDidRemoveConnection = new Emitter();
        this.onDidRemoveConnection = this._onDidRemoveConnection.event;
        this.disposables = new DisposableStore();
        this.disposables.add(onDidClientConnect(({ protocol, onDidClientDisconnect }) => {
            const onFirstMessage = Event.once(protocol.onMessage);
            this.disposables.add(onFirstMessage(msg => {
                const reader = new BufferReader(msg);
                const ctx = deserialize(reader);
                const channelServer = new ChannelServer(protocol, ctx, ipcLogger, timeoutDelay);
                const channelClient = new ChannelClient(protocol, ipcLogger);
                this.channels.forEach((channel, name) => channelServer.registerChannel(name, channel));
                const connection = { channelServer, channelClient, ctx };
                this._connections.add(connection);
                this._onDidAddConnection.fire(connection);
                this.disposables.add(onDidClientDisconnect(() => {
                    channelServer.dispose();
                    channelClient.dispose();
                    this._connections.delete(connection);
                    this._onDidRemoveConnection.fire(connection);
                }));
            }));
        }));
    }
    getChannel(channelName, routerOrClientFilter) {
        const that = this;
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        return {
            call(command, arg, cancellationToken) {
                let connectionPromise;
                if (isFunction(routerOrClientFilter)) {
                    // when no router is provided, we go random client picking
                    const connection = getRandomElement(that.connections.filter(routerOrClientFilter));
                    connectionPromise = connection
                        // if we found a client, let's call on it
                        ? Promise.resolve(connection)
                        // else, let's wait for a client to come along
                        : Event.toPromise(Event.filter(that.onDidAddConnection, routerOrClientFilter));
                }
                else {
                    connectionPromise = routerOrClientFilter.routeCall(that, command, arg);
                }
                const channelPromise = connectionPromise
                    .then(connection => connection.channelClient.getChannel(channelName));
                return getDelayedChannel(channelPromise)
                    .call(command, arg, cancellationToken);
            },
            listen(event, arg) {
                if (isFunction(routerOrClientFilter)) {
                    return that.getMulticastEvent(channelName, routerOrClientFilter, event, arg);
                }
                const channelPromise = routerOrClientFilter.routeEvent(that, event, arg)
                    .then(connection => connection.channelClient.getChannel(channelName));
                return getDelayedChannel(channelPromise)
                    .listen(event, arg);
            }
        };
    }
    getMulticastEvent(channelName, clientFilter, eventName, arg) {
        const that = this;
        let disposables;
        // Create an emitter which hooks up to all clients
        // as soon as first listener is added. It also
        // disconnects from all clients as soon as the last listener
        // is removed.
        const emitter = new Emitter({
            onWillAddFirstListener: () => {
                disposables = new DisposableStore();
                // The event multiplexer is useful since the active
                // client list is dynamic. We need to hook up and disconnection
                // to/from clients as they come and go.
                const eventMultiplexer = new EventMultiplexer();
                const map = new Map();
                const onDidAddConnection = (connection) => {
                    const channel = connection.channelClient.getChannel(channelName);
                    const event = channel.listen(eventName, arg);
                    const disposable = eventMultiplexer.add(event);
                    map.set(connection, disposable);
                };
                const onDidRemoveConnection = (connection) => {
                    const disposable = map.get(connection);
                    if (!disposable) {
                        return;
                    }
                    disposable.dispose();
                    map.delete(connection);
                };
                that.connections.filter(clientFilter).forEach(onDidAddConnection);
                Event.filter(that.onDidAddConnection, clientFilter)(onDidAddConnection, undefined, disposables);
                that.onDidRemoveConnection(onDidRemoveConnection, undefined, disposables);
                eventMultiplexer.event(emitter.fire, emitter, disposables);
                disposables.add(eventMultiplexer);
            },
            onDidRemoveLastListener: () => {
                disposables?.dispose();
                disposables = undefined;
            }
        });
        that.disposables.add(emitter);
        return emitter.event;
    }
    registerChannel(channelName, channel) {
        this.channels.set(channelName, channel);
        for (const connection of this._connections) {
            connection.channelServer.registerChannel(channelName, channel);
        }
    }
    dispose() {
        this.disposables.dispose();
        for (const connection of this._connections) {
            connection.channelClient.dispose();
            connection.channelServer.dispose();
        }
        this._connections.clear();
        this.channels.clear();
        this._onDidAddConnection.dispose();
        this._onDidRemoveConnection.dispose();
    }
}
/**
 * An `IPCClient` is both a channel client and a channel server.
 *
 * As the owner of a protocol, you should extend both this
 * and the `IPCServer` classes to get IPC implementations
 * for your protocol.
 */
export class IPCClient {
    constructor(protocol, ctx, ipcLogger = null) {
        const writer = new BufferWriter();
        serialize(writer, ctx);
        protocol.send(writer.buffer);
        this.channelClient = new ChannelClient(protocol, ipcLogger);
        this.channelServer = new ChannelServer(protocol, ctx, ipcLogger);
    }
    getChannel(channelName) {
        return this.channelClient.getChannel(channelName);
    }
    registerChannel(channelName, channel) {
        this.channelServer.registerChannel(channelName, channel);
    }
    dispose() {
        this.channelClient.dispose();
        this.channelServer.dispose();
    }
}
export function getDelayedChannel(promise) {
    // eslint-disable-next-line local/code-no-dangerous-type-assertions
    return {
        call(command, arg, cancellationToken) {
            return promise.then(c => c.call(command, arg, cancellationToken));
        },
        listen(event, arg) {
            const relay = new Relay();
            promise.then(c => relay.input = c.listen(event, arg));
            return relay.event;
        }
    };
}
export function getNextTickChannel(channel) {
    let didTick = false;
    // eslint-disable-next-line local/code-no-dangerous-type-assertions
    return {
        call(command, arg, cancellationToken) {
            if (didTick) {
                return channel.call(command, arg, cancellationToken);
            }
            return timeout(0)
                .then(() => didTick = true)
                .then(() => channel.call(command, arg, cancellationToken));
        },
        listen(event, arg) {
            if (didTick) {
                return channel.listen(event, arg);
            }
            const relay = new Relay();
            timeout(0)
                .then(() => didTick = true)
                .then(() => relay.input = channel.listen(event, arg));
            return relay.event;
        }
    };
}
export class StaticRouter {
    constructor(fn) {
        this.fn = fn;
    }
    routeCall(hub) {
        return this.route(hub);
    }
    routeEvent(hub) {
        return this.route(hub);
    }
    async route(hub) {
        for (const connection of hub.connections) {
            if (await Promise.resolve(this.fn(connection.ctx))) {
                return Promise.resolve(connection);
            }
        }
        await Event.toPromise(hub.onDidAddConnection);
        return await this.route(hub);
    }
}
/**
 * Use ProxyChannels to automatically wrapping and unwrapping
 * services to/from IPC channels, instead of manually wrapping
 * each service method and event.
 *
 * Restrictions:
 * - If marshalling is enabled, only `URI` and `RegExp` is converted
 *   automatically for you
 * - Events must follow the naming convention `onUpperCase`
 * - `CancellationToken` is currently not supported
 * - If a context is provided, you can use `AddFirstParameterToFunctions`
 *   utility to signal this in the receiving side type
 */
export var ProxyChannel;
(function (ProxyChannel) {
    function fromService(service, disposables, options) {
        const handler = service;
        const disableMarshalling = options?.disableMarshalling;
        // Buffer any event that should be supported by
        // iterating over all property keys and finding them
        // However, this will not work for services that
        // are lazy and use a Proxy within. For that we
        // still need to check later (see below).
        const mapEventNameToEvent = new Map();
        for (const key in handler) {
            if (propertyIsEvent(key)) {
                mapEventNameToEvent.set(key, Event.buffer(handler[key], true, undefined, disposables));
            }
        }
        return new class {
            listen(_, event, arg) {
                const eventImpl = mapEventNameToEvent.get(event);
                if (eventImpl) {
                    return eventImpl;
                }
                const target = handler[event];
                if (typeof target === 'function') {
                    if (propertyIsDynamicEvent(event)) {
                        return target.call(handler, arg);
                    }
                    if (propertyIsEvent(event)) {
                        mapEventNameToEvent.set(event, Event.buffer(handler[event], true, undefined, disposables));
                        return mapEventNameToEvent.get(event);
                    }
                }
                throw new ErrorNoTelemetry(`Event not found: ${event}`);
            }
            call(_, command, args) {
                const target = handler[command];
                if (typeof target === 'function') {
                    // Revive unless marshalling disabled
                    if (!disableMarshalling && Array.isArray(args)) {
                        for (let i = 0; i < args.length; i++) {
                            args[i] = revive(args[i]);
                        }
                    }
                    let res = target.apply(handler, args);
                    if (!(res instanceof Promise)) {
                        res = Promise.resolve(res);
                    }
                    return res;
                }
                throw new ErrorNoTelemetry(`Method not found: ${command}`);
            }
        };
    }
    ProxyChannel.fromService = fromService;
    function toService(channel, options) {
        const disableMarshalling = options?.disableMarshalling;
        return new Proxy({}, {
            get(_target, propKey) {
                if (typeof propKey === 'string') {
                    // Check for predefined values
                    if (options?.properties?.has(propKey)) {
                        return options.properties.get(propKey);
                    }
                    // Dynamic Event
                    if (propertyIsDynamicEvent(propKey)) {
                        return function (arg) {
                            return channel.listen(propKey, arg);
                        };
                    }
                    // Event
                    if (propertyIsEvent(propKey)) {
                        return channel.listen(propKey);
                    }
                    // Function
                    return async function (...args) {
                        // Add context if any
                        let methodArgs;
                        if (options && !isUndefinedOrNull(options.context)) {
                            methodArgs = [options.context, ...args];
                        }
                        else {
                            methodArgs = args;
                        }
                        const result = await channel.call(propKey, methodArgs);
                        // Revive unless marshalling disabled
                        if (!disableMarshalling) {
                            return revive(result);
                        }
                        return result;
                    };
                }
                throw new ErrorNoTelemetry(`Property not found: ${String(propKey)}`);
            }
        });
    }
    ProxyChannel.toService = toService;
    function propertyIsEvent(name) {
        // Assume a property is an event if it has a form of "onSomething"
        return name[0] === 'o' && name[1] === 'n' && strings.isUpperAsciiLetter(name.charCodeAt(2));
    }
    function propertyIsDynamicEvent(name) {
        // Assume a property is a dynamic event (a method that returns an event) if it has a form of "onDynamicSomething"
        return /^onDynamic/.test(name) && strings.isUpperAsciiLetter(name.charCodeAt(9));
    }
})(ProxyChannel || (ProxyChannel = {}));
const colorTables = [
    ['#2977B1', '#FC802D', '#34A13A', '#D3282F', '#9366BA'],
    ['#8B564C', '#E177C0', '#7F7F7F', '#BBBE3D', '#2EBECD']
];
function prettyWithoutArrays(data) {
    if (Array.isArray(data)) {
        return data;
    }
    if (data && typeof data === 'object' && typeof data.toString === 'function') {
        const result = data.toString();
        if (result !== '[object Object]') {
            return result;
        }
    }
    return data;
}
function pretty(data) {
    if (Array.isArray(data)) {
        return data.map(prettyWithoutArrays);
    }
    return prettyWithoutArrays(data);
}
function logWithColors(direction, totalLength, msgLength, req, initiator, str, data) {
    data = pretty(data);
    const colorTable = colorTables[initiator];
    const color = colorTable[req % colorTable.length];
    let args = [`%c[${direction}]%c[${String(totalLength).padStart(7, ' ')}]%c[len: ${String(msgLength).padStart(5, ' ')}]%c${String(req).padStart(5, ' ')} - ${str}`, 'color: darkgreen', 'color: grey', 'color: grey', `color: ${color}`];
    if (/\($/.test(str)) {
        args = args.concat(data);
        args.push(')');
    }
    else {
        args.push(data);
    }
    console.log.apply(console, args);
}
export class IPCLogger {
    constructor(_outgoingPrefix, _incomingPrefix) {
        this._outgoingPrefix = _outgoingPrefix;
        this._incomingPrefix = _incomingPrefix;
        this._totalIncoming = 0;
        this._totalOutgoing = 0;
    }
    logOutgoing(msgLength, requestId, initiator, str, data) {
        this._totalOutgoing += msgLength;
        logWithColors(this._outgoingPrefix, this._totalOutgoing, msgLength, requestId, initiator, str, data);
    }
    logIncoming(msgLength, requestId, initiator, str, data) {
        this._totalIncoming += msgLength;
        logWithColors(this._incomingPrefix, this._totalIncoming, msgLength, requestId, initiator, str, data);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXBjLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvcGFydHMvaXBjL2NvbW1vbi9pcGMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDN0QsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxPQUFPLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMvRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDckQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLHVCQUF1QixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDN0YsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ2hGLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ25GLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3pFLE9BQU8sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFlLFlBQVksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ25HLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN4RCxPQUFPLEtBQUssT0FBTyxNQUFNLDRCQUE0QixDQUFDO0FBQ3RELE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQXVCekUsSUFBVyxXQUtWO0FBTEQsV0FBVyxXQUFXO0lBQ3JCLHFEQUFhLENBQUE7SUFDYixpRUFBbUIsQ0FBQTtJQUNuQiw2REFBaUIsQ0FBQTtJQUNqQiwrREFBa0IsQ0FBQTtBQUNuQixDQUFDLEVB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