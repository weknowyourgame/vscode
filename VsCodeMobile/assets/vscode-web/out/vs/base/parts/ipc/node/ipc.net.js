/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createHash } from 'crypto';
import { createConnection, createServer } from 'net';
import { tmpdir } from 'os';
import { createDeflateRaw, createInflateRaw } from 'zlib';
import { VSBuffer } from '../../../common/buffer.js';
import { onUnexpectedError } from '../../../common/errors.js';
import { Emitter, Event } from '../../../common/event.js';
import { Disposable } from '../../../common/lifecycle.js';
import { join } from '../../../common/path.js';
import { platform } from '../../../common/platform.js';
import { generateUuid } from '../../../common/uuid.js';
import { IPCServer } from '../common/ipc.js';
import { ChunkStream, Client, Protocol, SocketDiagnostics } from '../common/ipc.net.js';
export function upgradeToISocket(req, socket, { debugLabel, skipWebSocketFrames = false, disableWebSocketCompression = false, }) {
    if (req.headers.upgrade === undefined || req.headers.upgrade.toLowerCase() !== 'websocket') {
        socket.end('HTTP/1.1 400 Bad Request');
        return;
    }
    // https://tools.ietf.org/html/rfc6455#section-4
    const requestNonce = req.headers['sec-websocket-key'];
    const hash = createHash('sha1'); // CodeQL [SM04514] SHA1 must be used here to respect the WebSocket protocol specification
    hash.update(requestNonce + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
    const responseNonce = hash.digest('base64');
    const responseHeaders = [
        `HTTP/1.1 101 Switching Protocols`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Accept: ${responseNonce}`
    ];
    // See https://tools.ietf.org/html/rfc7692#page-12
    let permessageDeflate = false;
    if (!skipWebSocketFrames && !disableWebSocketCompression && req.headers['sec-websocket-extensions']) {
        const websocketExtensionOptions = Array.isArray(req.headers['sec-websocket-extensions']) ? req.headers['sec-websocket-extensions'] : [req.headers['sec-websocket-extensions']];
        for (const websocketExtensionOption of websocketExtensionOptions) {
            if (/\b((server_max_window_bits)|(server_no_context_takeover)|(client_no_context_takeover))\b/.test(websocketExtensionOption)) {
                // sorry, the server does not support zlib parameter tweaks
                continue;
            }
            if (/\b(permessage-deflate)\b/.test(websocketExtensionOption)) {
                permessageDeflate = true;
                responseHeaders.push(`Sec-WebSocket-Extensions: permessage-deflate`);
                break;
            }
            if (/\b(x-webkit-deflate-frame)\b/.test(websocketExtensionOption)) {
                permessageDeflate = true;
                responseHeaders.push(`Sec-WebSocket-Extensions: x-webkit-deflate-frame`);
                break;
            }
        }
    }
    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
    // Never timeout this socket due to inactivity!
    socket.setTimeout(0);
    // Disable Nagle's algorithm
    socket.setNoDelay(true);
    // Finally!
    if (skipWebSocketFrames) {
        return new NodeSocket(socket, debugLabel);
    }
    else {
        return new WebSocketNodeSocket(new NodeSocket(socket, debugLabel), permessageDeflate, null, true);
    }
}
/**
 * Maximum time to wait for a 'close' event to fire after the socket stream
 * ends. For unix domain sockets, the close event may not fire consistently
 * due to what appears to be a Node.js bug.
 *
 * @see https://github.com/microsoft/vscode/issues/211462#issuecomment-2155471996
 */
const socketEndTimeoutMs = 30_000;
export class NodeSocket {
    traceSocketEvent(type, data) {
        SocketDiagnostics.traceSocketEvent(this.socket, this.debugLabel, type, data);
    }
    constructor(socket, debugLabel = '') {
        this._canWrite = true;
        this.debugLabel = debugLabel;
        this.socket = socket;
        this.traceSocketEvent("created" /* SocketDiagnosticsEventType.Created */, { type: 'NodeSocket' });
        this._errorListener = (err) => {
            this.traceSocketEvent("error" /* SocketDiagnosticsEventType.Error */, { code: err?.code, message: err?.message });
            if (err) {
                if (err.code === 'EPIPE') {
                    // An EPIPE exception at the wrong time can lead to a renderer process crash
                    // so ignore the error since the socket will fire the close event soon anyways:
                    // > https://nodejs.org/api/errors.html#errors_common_system_errors
                    // > EPIPE (Broken pipe): A write on a pipe, socket, or FIFO for which there is no
                    // > process to read the data. Commonly encountered at the net and http layers,
                    // > indicative that the remote side of the stream being written to has been closed.
                    return;
                }
                onUnexpectedError(err);
            }
        };
        this.socket.on('error', this._errorListener);
        let endTimeoutHandle;
        this._closeListener = (hadError) => {
            this.traceSocketEvent("close" /* SocketDiagnosticsEventType.Close */, { hadError });
            this._canWrite = false;
            if (endTimeoutHandle) {
                clearTimeout(endTimeoutHandle);
            }
        };
        this.socket.on('close', this._closeListener);
        this._endListener = () => {
            this.traceSocketEvent("nodeEndReceived" /* SocketDiagnosticsEventType.NodeEndReceived */);
            this._canWrite = false;
            endTimeoutHandle = setTimeout(() => socket.destroy(), socketEndTimeoutMs);
        };
        this.socket.on('end', this._endListener);
    }
    dispose() {
        this.socket.off('error', this._errorListener);
        this.socket.off('close', this._closeListener);
        this.socket.off('end', this._endListener);
        this.socket.destroy();
    }
    onData(_listener) {
        const listener = (buff) => {
            this.traceSocketEvent("read" /* SocketDiagnosticsEventType.Read */, buff);
            _listener(VSBuffer.wrap(buff));
        };
        this.socket.on('data', listener);
        return {
            dispose: () => this.socket.off('data', listener)
        };
    }
    onClose(listener) {
        const adapter = (hadError) => {
            listener({
                type: 0 /* SocketCloseEventType.NodeSocketCloseEvent */,
                hadError: hadError,
                error: undefined
            });
        };
        this.socket.on('close', adapter);
        return {
            dispose: () => this.socket.off('close', adapter)
        };
    }
    onEnd(listener) {
        const adapter = () => {
            listener();
        };
        this.socket.on('end', adapter);
        return {
            dispose: () => this.socket.off('end', adapter)
        };
    }
    write(buffer) {
        // return early if socket has been destroyed in the meantime
        if (this.socket.destroyed || !this._canWrite) {
            return;
        }
        // we ignore the returned value from `write` because we would have to cached the data
        // anyways and nodejs is already doing that for us:
        // > https://nodejs.org/api/stream.html#stream_writable_write_chunk_encoding_callback
        // > However, the false return value is only advisory and the writable stream will unconditionally
        // > accept and buffer chunk even if it has not been allowed to drain.
        try {
            this.traceSocketEvent("write" /* SocketDiagnosticsEventType.Write */, buffer);
            this.socket.write(buffer.buffer, (err) => {
                if (err) {
                    if (err.code === 'EPIPE') {
                        // An EPIPE exception at the wrong time can lead to a renderer process crash
                        // so ignore the error since the socket will fire the close event soon anyways:
                        // > https://nodejs.org/api/errors.html#errors_common_system_errors
                        // > EPIPE (Broken pipe): A write on a pipe, socket, or FIFO for which there is no
                        // > process to read the data. Commonly encountered at the net and http layers,
                        // > indicative that the remote side of the stream being written to has been closed.
                        return;
                    }
                    onUnexpectedError(err);
                }
            });
        }
        catch (err) {
            if (err.code === 'EPIPE') {
                // An EPIPE exception at the wrong time can lead to a renderer process crash
                // so ignore the error since the socket will fire the close event soon anyways:
                // > https://nodejs.org/api/errors.html#errors_common_system_errors
                // > EPIPE (Broken pipe): A write on a pipe, socket, or FIFO for which there is no
                // > process to read the data. Commonly encountered at the net and http layers,
                // > indicative that the remote side of the stream being written to has been closed.
                return;
            }
            onUnexpectedError(err);
        }
    }
    end() {
        this.traceSocketEvent("nodeEndSent" /* SocketDiagnosticsEventType.NodeEndSent */);
        this.socket.end();
    }
    drain() {
        this.traceSocketEvent("nodeDrainBegin" /* SocketDiagnosticsEventType.NodeDrainBegin */);
        return new Promise((resolve, reject) => {
            if (this.socket.bufferSize === 0) {
                this.traceSocketEvent("nodeDrainEnd" /* SocketDiagnosticsEventType.NodeDrainEnd */);
                resolve();
                return;
            }
            const finished = () => {
                this.socket.off('close', finished);
                this.socket.off('end', finished);
                this.socket.off('error', finished);
                this.socket.off('timeout', finished);
                this.socket.off('drain', finished);
                this.traceSocketEvent("nodeDrainEnd" /* SocketDiagnosticsEventType.NodeDrainEnd */);
                resolve();
            };
            this.socket.on('close', finished);
            this.socket.on('end', finished);
            this.socket.on('error', finished);
            this.socket.on('timeout', finished);
            this.socket.on('drain', finished);
        });
    }
}
var Constants;
(function (Constants) {
    Constants[Constants["MinHeaderByteSize"] = 2] = "MinHeaderByteSize";
    /**
     * If we need to write a large buffer, we will split it into 256KB chunks and
     * send each chunk as a websocket message. This is to prevent that the sending
     * side is stuck waiting for the entire buffer to be compressed before writing
     * to the underlying socket or that the receiving side is stuck waiting for the
     * entire message to be received before processing the bytes.
     */
    Constants[Constants["MaxWebSocketMessageLength"] = 262144] = "MaxWebSocketMessageLength"; // 256 KB
})(Constants || (Constants = {}));
var ReadState;
(function (ReadState) {
    ReadState[ReadState["PeekHeader"] = 1] = "PeekHeader";
    ReadState[ReadState["ReadHeader"] = 2] = "ReadHeader";
    ReadState[ReadState["ReadBody"] = 3] = "ReadBody";
    ReadState[ReadState["Fin"] = 4] = "Fin";
})(ReadState || (ReadState = {}));
/**
 * See https://tools.ietf.org/html/rfc6455#section-5.2
 */
export class WebSocketNodeSocket extends Disposable {
    get permessageDeflate() {
        return this._flowManager.permessageDeflate;
    }
    get recordedInflateBytes() {
        return this._flowManager.recordedInflateBytes;
    }
    traceSocketEvent(type, data) {
        this.socket.traceSocketEvent(type, data);
    }
    /**
     * Create a socket which can communicate using WebSocket frames.
     *
     * **NOTE**: When using the permessage-deflate WebSocket extension, if parts of inflating was done
     *  in a different zlib instance, we need to pass all those bytes into zlib, otherwise the inflate
     *  might hit an inflated portion referencing a distance too far back.
     *
     * @param socket The underlying socket
     * @param permessageDeflate Use the permessage-deflate WebSocket extension
     * @param inflateBytes "Seed" zlib inflate with these bytes.
     * @param recordInflateBytes Record all bytes sent to inflate
     */
    constructor(socket, permessageDeflate, inflateBytes, recordInflateBytes) {
        super();
        this._onData = this._register(new Emitter());
        this._onClose = this._register(new Emitter());
        this._isEnded = false;
        this._state = {
            state: 1 /* ReadState.PeekHeader */,
            readLen: 2 /* Constants.MinHeaderByteSize */,
            fin: 0,
            compressed: false,
            firstFrameOfMessage: true,
            mask: 0,
            opcode: 0
        };
        this.socket = socket;
        this.traceSocketEvent("created" /* SocketDiagnosticsEventType.Created */, { type: 'WebSocketNodeSocket', permessageDeflate, inflateBytesLength: inflateBytes?.byteLength || 0, recordInflateBytes });
        this._flowManager = this._register(new WebSocketFlowManager(this, permessageDeflate, inflateBytes, recordInflateBytes, this._onData, (data, options) => this._write(data, options)));
        this._register(this._flowManager.onError((err) => {
            // zlib errors are fatal, since we have no idea how to recover
            console.error(err);
            onUnexpectedError(err);
            this._onClose.fire({
                type: 0 /* SocketCloseEventType.NodeSocketCloseEvent */,
                hadError: true,
                error: err
            });
        }));
        this._incomingData = new ChunkStream();
        this._register(this.socket.onData(data => this._acceptChunk(data)));
        this._register(this.socket.onClose(async (e) => {
            // Delay surfacing the close event until the async inflating is done
            // and all data has been emitted
            if (this._flowManager.isProcessingReadQueue()) {
                await Event.toPromise(this._flowManager.onDidFinishProcessingReadQueue);
            }
            this._onClose.fire(e);
        }));
    }
    dispose() {
        if (this._flowManager.isProcessingWriteQueue()) {
            // Wait for any outstanding writes to finish before disposing
            this._register(this._flowManager.onDidFinishProcessingWriteQueue(() => {
                this.dispose();
            }));
        }
        else {
            this.socket.dispose();
            super.dispose();
        }
    }
    onData(listener) {
        return this._onData.event(listener);
    }
    onClose(listener) {
        return this._onClose.event(listener);
    }
    onEnd(listener) {
        return this.socket.onEnd(listener);
    }
    write(buffer) {
        // If we write many logical messages (let's say 1000 messages of 100KB) during a single process tick, we do
        // this thing where we install a process.nextTick timer and group all of them together and we then issue a
        // single WebSocketNodeSocket.write with a 100MB buffer.
        //
        // The first problem is that the actual writing to the underlying node socket will only happen after all of
        // the 100MB have been deflated (due to waiting on zlib flush). The second problem is on the reading side,
        // where we will get a single WebSocketNodeSocket.onData event fired when all the 100MB have arrived,
        // delaying processing the 1000 received messages until all have arrived, instead of processing them as each
        // one arrives.
        //
        // We therefore split the buffer into chunks, and issue a write for each chunk.
        let start = 0;
        while (start < buffer.byteLength) {
            this._flowManager.writeMessage(buffer.slice(start, Math.min(start + 262144 /* Constants.MaxWebSocketMessageLength */, buffer.byteLength)), { compressed: true, opcode: 0x02 /* Binary frame */ });
            start += 262144 /* Constants.MaxWebSocketMessageLength */;
        }
    }
    _write(buffer, { compressed, opcode }) {
        if (this._isEnded) {
            // Avoid ERR_STREAM_WRITE_AFTER_END
            return;
        }
        this.traceSocketEvent("webSocketNodeSocketWrite" /* SocketDiagnosticsEventType.WebSocketNodeSocketWrite */, buffer);
        let headerLen = 2 /* Constants.MinHeaderByteSize */;
        if (buffer.byteLength < 126) {
            headerLen += 0;
        }
        else if (buffer.byteLength < 2 ** 16) {
            headerLen += 2;
        }
        else {
            headerLen += 8;
        }
        const header = VSBuffer.alloc(headerLen);
        // The RSV1 bit indicates a compressed frame
        const compressedFlag = compressed ? 0b01000000 : 0;
        const opcodeFlag = opcode & 0b00001111;
        header.writeUInt8(0b10000000 | compressedFlag | opcodeFlag, 0);
        if (buffer.byteLength < 126) {
            header.writeUInt8(buffer.byteLength, 1);
        }
        else if (buffer.byteLength < 2 ** 16) {
            header.writeUInt8(126, 1);
            let offset = 1;
            header.writeUInt8((buffer.byteLength >>> 8) & 0b11111111, ++offset);
            header.writeUInt8((buffer.byteLength >>> 0) & 0b11111111, ++offset);
        }
        else {
            header.writeUInt8(127, 1);
            let offset = 1;
            header.writeUInt8(0, ++offset);
            header.writeUInt8(0, ++offset);
            header.writeUInt8(0, ++offset);
            header.writeUInt8(0, ++offset);
            header.writeUInt8((buffer.byteLength >>> 24) & 0b11111111, ++offset);
            header.writeUInt8((buffer.byteLength >>> 16) & 0b11111111, ++offset);
            header.writeUInt8((buffer.byteLength >>> 8) & 0b11111111, ++offset);
            header.writeUInt8((buffer.byteLength >>> 0) & 0b11111111, ++offset);
        }
        this.socket.write(VSBuffer.concat([header, buffer]));
    }
    end() {
        this._isEnded = true;
        this.socket.end();
    }
    _acceptChunk(data) {
        if (data.byteLength === 0) {
            return;
        }
        this._incomingData.acceptChunk(data);
        while (this._incomingData.byteLength >= this._state.readLen) {
            if (this._state.state === 1 /* ReadState.PeekHeader */) {
                // peek to see if we can read the entire header
                const peekHeader = this._incomingData.peek(this._state.readLen);
                const firstByte = peekHeader.readUInt8(0);
                const finBit = (firstByte & 0b10000000) >>> 7;
                const rsv1Bit = (firstByte & 0b01000000) >>> 6;
                const opcode = (firstByte & 0b00001111);
                const secondByte = peekHeader.readUInt8(1);
                const hasMask = (secondByte & 0b10000000) >>> 7;
                const len = (secondByte & 0b01111111);
                this._state.state = 2 /* ReadState.ReadHeader */;
                this._state.readLen = 2 /* Constants.MinHeaderByteSize */ + (hasMask ? 4 : 0) + (len === 126 ? 2 : 0) + (len === 127 ? 8 : 0);
                this._state.fin = finBit;
                if (this._state.firstFrameOfMessage) {
                    // if the frame is compressed, the RSV1 bit is set only for the first frame of the message
                    this._state.compressed = Boolean(rsv1Bit);
                }
                this._state.firstFrameOfMessage = Boolean(finBit);
                this._state.mask = 0;
                this._state.opcode = opcode;
                this.traceSocketEvent("webSocketNodeSocketPeekedHeader" /* SocketDiagnosticsEventType.WebSocketNodeSocketPeekedHeader */, { headerSize: this._state.readLen, compressed: this._state.compressed, fin: this._state.fin, opcode: this._state.opcode });
            }
            else if (this._state.state === 2 /* ReadState.ReadHeader */) {
                // read entire header
                const header = this._incomingData.read(this._state.readLen);
                const secondByte = header.readUInt8(1);
                const hasMask = (secondByte & 0b10000000) >>> 7;
                let len = (secondByte & 0b01111111);
                let offset = 1;
                if (len === 126) {
                    len = (header.readUInt8(++offset) * 2 ** 8
                        + header.readUInt8(++offset));
                }
                else if (len === 127) {
                    len = (header.readUInt8(++offset) * 0
                        + header.readUInt8(++offset) * 0
                        + header.readUInt8(++offset) * 0
                        + header.readUInt8(++offset) * 0
                        + header.readUInt8(++offset) * 2 ** 24
                        + header.readUInt8(++offset) * 2 ** 16
                        + header.readUInt8(++offset) * 2 ** 8
                        + header.readUInt8(++offset));
                }
                let mask = 0;
                if (hasMask) {
                    mask = (header.readUInt8(++offset) * 2 ** 24
                        + header.readUInt8(++offset) * 2 ** 16
                        + header.readUInt8(++offset) * 2 ** 8
                        + header.readUInt8(++offset));
                }
                this._state.state = 3 /* ReadState.ReadBody */;
                this._state.readLen = len;
                this._state.mask = mask;
                this.traceSocketEvent("webSocketNodeSocketPeekedHeader" /* SocketDiagnosticsEventType.WebSocketNodeSocketPeekedHeader */, { bodySize: this._state.readLen, compressed: this._state.compressed, fin: this._state.fin, mask: this._state.mask, opcode: this._state.opcode });
            }
            else if (this._state.state === 3 /* ReadState.ReadBody */) {
                // read body
                const body = this._incomingData.read(this._state.readLen);
                this.traceSocketEvent("webSocketNodeSocketReadData" /* SocketDiagnosticsEventType.WebSocketNodeSocketReadData */, body);
                unmask(body, this._state.mask);
                this.traceSocketEvent("webSocketNodeSocketUnmaskedData" /* SocketDiagnosticsEventType.WebSocketNodeSocketUnmaskedData */, body);
                this._state.state = 1 /* ReadState.PeekHeader */;
                this._state.readLen = 2 /* Constants.MinHeaderByteSize */;
                this._state.mask = 0;
                if (this._state.opcode <= 0x02 /* Continuation frame or Text frame or binary frame */) {
                    this._flowManager.acceptFrame(body, this._state.compressed, !!this._state.fin);
                }
                else if (this._state.opcode === 0x09 /* Ping frame */) {
                    // Ping frames could be send by some browsers e.g. Firefox
                    this._flowManager.writeMessage(body, { compressed: false, opcode: 0x0A /* Pong frame */ });
                }
            }
        }
    }
    async drain() {
        this.traceSocketEvent("webSocketNodeSocketDrainBegin" /* SocketDiagnosticsEventType.WebSocketNodeSocketDrainBegin */);
        if (this._flowManager.isProcessingWriteQueue()) {
            await Event.toPromise(this._flowManager.onDidFinishProcessingWriteQueue);
        }
        await this.socket.drain();
        this.traceSocketEvent("webSocketNodeSocketDrainEnd" /* SocketDiagnosticsEventType.WebSocketNodeSocketDrainEnd */);
    }
}
class WebSocketFlowManager extends Disposable {
    get permessageDeflate() {
        return Boolean(this._zlibInflateStream && this._zlibDeflateStream);
    }
    get recordedInflateBytes() {
        if (this._zlibInflateStream) {
            return this._zlibInflateStream.recordedInflateBytes;
        }
        return VSBuffer.alloc(0);
    }
    constructor(_tracer, permessageDeflate, inflateBytes, recordInflateBytes, _onData, _writeFn) {
        super();
        this._tracer = _tracer;
        this._onData = _onData;
        this._writeFn = _writeFn;
        this._onError = this._register(new Emitter());
        this.onError = this._onError.event;
        this._writeQueue = [];
        this._readQueue = [];
        this._onDidFinishProcessingReadQueue = this._register(new Emitter());
        this.onDidFinishProcessingReadQueue = this._onDidFinishProcessingReadQueue.event;
        this._onDidFinishProcessingWriteQueue = this._register(new Emitter());
        this.onDidFinishProcessingWriteQueue = this._onDidFinishProcessingWriteQueue.event;
        this._isProcessingWriteQueue = false;
        this._isProcessingReadQueue = false;
        if (permessageDeflate) {
            // See https://tools.ietf.org/html/rfc7692#page-16
            // To simplify our logic, we don't negotiate the window size
            // and simply dedicate (2^15) / 32kb per web socket
            this._zlibInflateStream = this._register(new ZlibInflateStream(this._tracer, recordInflateBytes, inflateBytes, { windowBits: 15 }));
            this._zlibDeflateStream = this._register(new ZlibDeflateStream(this._tracer, { windowBits: 15 }));
            this._register(this._zlibInflateStream.onError((err) => this._onError.fire(err)));
            this._register(this._zlibDeflateStream.onError((err) => this._onError.fire(err)));
        }
        else {
            this._zlibInflateStream = null;
            this._zlibDeflateStream = null;
        }
    }
    writeMessage(data, options) {
        this._writeQueue.push({ data, options });
        this._processWriteQueue();
    }
    async _processWriteQueue() {
        if (this._isProcessingWriteQueue) {
            return;
        }
        this._isProcessingWriteQueue = true;
        while (this._writeQueue.length > 0) {
            const { data, options } = this._writeQueue.shift();
            if (this._zlibDeflateStream && options.compressed) {
                const compressedData = await this._deflateMessage(this._zlibDeflateStream, data);
                this._writeFn(compressedData, options);
            }
            else {
                this._writeFn(data, { ...options, compressed: false });
            }
        }
        this._isProcessingWriteQueue = false;
        this._onDidFinishProcessingWriteQueue.fire();
    }
    isProcessingWriteQueue() {
        return (this._isProcessingWriteQueue);
    }
    /**
     * Subsequent calls should wait for the previous `_deflateBuffer` call to complete.
     */
    _deflateMessage(zlibDeflateStream, buffer) {
        return new Promise((resolve, reject) => {
            zlibDeflateStream.write(buffer);
            zlibDeflateStream.flush(data => resolve(data));
        });
    }
    acceptFrame(data, isCompressed, isLastFrameOfMessage) {
        this._readQueue.push({ data, isCompressed, isLastFrameOfMessage });
        this._processReadQueue();
    }
    async _processReadQueue() {
        if (this._isProcessingReadQueue) {
            return;
        }
        this._isProcessingReadQueue = true;
        while (this._readQueue.length > 0) {
            const frameInfo = this._readQueue.shift();
            if (this._zlibInflateStream && frameInfo.isCompressed) {
                // See https://datatracker.ietf.org/doc/html/rfc7692#section-9.2
                // Even if permessageDeflate is negotiated, it is possible
                // that the other side might decide to send uncompressed messages
                // So only decompress messages that have the RSV 1 bit set
                const data = await this._inflateFrame(this._zlibInflateStream, frameInfo.data, frameInfo.isLastFrameOfMessage);
                this._onData.fire(data);
            }
            else {
                this._onData.fire(frameInfo.data);
            }
        }
        this._isProcessingReadQueue = false;
        this._onDidFinishProcessingReadQueue.fire();
    }
    isProcessingReadQueue() {
        return (this._isProcessingReadQueue);
    }
    /**
     * Subsequent calls should wait for the previous `transformRead` call to complete.
     */
    _inflateFrame(zlibInflateStream, buffer, isLastFrameOfMessage) {
        return new Promise((resolve, reject) => {
            // See https://tools.ietf.org/html/rfc7692#section-7.2.2
            zlibInflateStream.write(buffer);
            if (isLastFrameOfMessage) {
                zlibInflateStream.write(VSBuffer.fromByteArray([0x00, 0x00, 0xff, 0xff]));
            }
            zlibInflateStream.flush(data => resolve(data));
        });
    }
}
class ZlibInflateStream extends Disposable {
    get recordedInflateBytes() {
        if (this._recordInflateBytes) {
            return VSBuffer.concat(this._recordedInflateBytes);
        }
        return VSBuffer.alloc(0);
    }
    constructor(_tracer, _recordInflateBytes, inflateBytes, options) {
        super();
        this._tracer = _tracer;
        this._recordInflateBytes = _recordInflateBytes;
        this._onError = this._register(new Emitter());
        this.onError = this._onError.event;
        this._recordedInflateBytes = [];
        this._pendingInflateData = [];
        this._zlibInflate = createInflateRaw(options);
        this._zlibInflate.on('error', (err) => {
            this._tracer.traceSocketEvent("zlibInflateError" /* SocketDiagnosticsEventType.zlibInflateError */, { message: err?.message, code: err?.code });
            this._onError.fire(err);
        });
        this._zlibInflate.on('data', (data) => {
            this._tracer.traceSocketEvent("zlibInflateData" /* SocketDiagnosticsEventType.zlibInflateData */, data);
            this._pendingInflateData.push(VSBuffer.wrap(data));
        });
        if (inflateBytes) {
            this._tracer.traceSocketEvent("zlibInflateInitialWrite" /* SocketDiagnosticsEventType.zlibInflateInitialWrite */, inflateBytes.buffer);
            this._zlibInflate.write(inflateBytes.buffer);
            this._zlibInflate.flush(() => {
                this._tracer.traceSocketEvent("zlibInflateInitialFlushFired" /* SocketDiagnosticsEventType.zlibInflateInitialFlushFired */);
                this._pendingInflateData.length = 0;
            });
        }
    }
    write(buffer) {
        if (this._recordInflateBytes) {
            this._recordedInflateBytes.push(buffer.clone());
        }
        this._tracer.traceSocketEvent("zlibInflateWrite" /* SocketDiagnosticsEventType.zlibInflateWrite */, buffer);
        this._zlibInflate.write(buffer.buffer);
    }
    flush(callback) {
        this._zlibInflate.flush(() => {
            this._tracer.traceSocketEvent("zlibInflateFlushFired" /* SocketDiagnosticsEventType.zlibInflateFlushFired */);
            const data = VSBuffer.concat(this._pendingInflateData);
            this._pendingInflateData.length = 0;
            callback(data);
        });
    }
}
class ZlibDeflateStream extends Disposable {
    constructor(_tracer, options) {
        super();
        this._tracer = _tracer;
        this._onError = this._register(new Emitter());
        this.onError = this._onError.event;
        this._pendingDeflateData = [];
        this._zlibDeflate = createDeflateRaw({
            windowBits: 15
        });
        this._zlibDeflate.on('error', (err) => {
            this._tracer.traceSocketEvent("zlibDeflateError" /* SocketDiagnosticsEventType.zlibDeflateError */, { message: err?.message, code: err?.code });
            this._onError.fire(err);
        });
        this._zlibDeflate.on('data', (data) => {
            this._tracer.traceSocketEvent("zlibDeflateData" /* SocketDiagnosticsEventType.zlibDeflateData */, data);
            this._pendingDeflateData.push(VSBuffer.wrap(data));
        });
    }
    write(buffer) {
        this._tracer.traceSocketEvent("zlibDeflateWrite" /* SocketDiagnosticsEventType.zlibDeflateWrite */, buffer.buffer);
        this._zlibDeflate.write(buffer.buffer);
    }
    flush(callback) {
        // See https://zlib.net/manual.html#Constants
        this._zlibDeflate.flush(/*Z_SYNC_FLUSH*/ 2, () => {
            this._tracer.traceSocketEvent("zlibDeflateFlushFired" /* SocketDiagnosticsEventType.zlibDeflateFlushFired */);
            let data = VSBuffer.concat(this._pendingDeflateData);
            this._pendingDeflateData.length = 0;
            // See https://tools.ietf.org/html/rfc7692#section-7.2.1
            data = data.slice(0, data.byteLength - 4);
            callback(data);
        });
    }
}
function unmask(buffer, mask) {
    if (mask === 0) {
        return;
    }
    const cnt = buffer.byteLength >>> 2;
    for (let i = 0; i < cnt; i++) {
        const v = buffer.readUInt32BE(i * 4);
        buffer.writeUInt32BE(v ^ mask, i * 4);
    }
    const offset = cnt * 4;
    const bytesLeft = buffer.byteLength - offset;
    const m3 = (mask >>> 24) & 0b11111111;
    const m2 = (mask >>> 16) & 0b11111111;
    const m1 = (mask >>> 8) & 0b11111111;
    if (bytesLeft >= 1) {
        buffer.writeUInt8(buffer.readUInt8(offset) ^ m3, offset);
    }
    if (bytesLeft >= 2) {
        buffer.writeUInt8(buffer.readUInt8(offset + 1) ^ m2, offset + 1);
    }
    if (bytesLeft >= 3) {
        buffer.writeUInt8(buffer.readUInt8(offset + 2) ^ m1, offset + 2);
    }
}
// Read this before there's any chance it is overwritten
// Related to https://github.com/microsoft/vscode/issues/30624
export const XDG_RUNTIME_DIR = process.env['XDG_RUNTIME_DIR'];
const safeIpcPathLengths = {
    [2 /* Platform.Linux */]: 107,
    [1 /* Platform.Mac */]: 103
};
export function createRandomIPCHandle() {
    const randomSuffix = generateUuid();
    // Windows: use named pipe
    if (process.platform === 'win32') {
        return `\\\\.\\pipe\\vscode-ipc-${randomSuffix}-sock`;
    }
    // Mac & Unix: Use socket file
    // Unix: Prefer XDG_RUNTIME_DIR over user data path
    const basePath = process.platform !== 'darwin' && XDG_RUNTIME_DIR ? XDG_RUNTIME_DIR : tmpdir();
    const result = join(basePath, `vscode-ipc-${randomSuffix}.sock`);
    // Validate length
    validateIPCHandleLength(result);
    return result;
}
export function createStaticIPCHandle(directoryPath, type, version) {
    const scope = createHash('sha256').update(directoryPath).digest('hex');
    const scopeForSocket = scope.substr(0, 8);
    // Windows: use named pipe
    if (process.platform === 'win32') {
        return `\\\\.\\pipe\\${scopeForSocket}-${version}-${type}-sock`;
    }
    // Mac & Unix: Use socket file
    // Unix: Prefer XDG_RUNTIME_DIR over user data path, unless portable
    // Trim the version and type values for the socket to prevent too large
    // file names causing issues: https://unix.stackexchange.com/q/367008
    const versionForSocket = version.substr(0, 4);
    const typeForSocket = type.substr(0, 6);
    let result;
    if (process.platform !== 'darwin' && XDG_RUNTIME_DIR && !process.env['VSCODE_PORTABLE']) {
        result = join(XDG_RUNTIME_DIR, `vscode-${scopeForSocket}-${versionForSocket}-${typeForSocket}.sock`);
    }
    else {
        result = join(directoryPath, `${versionForSocket}-${typeForSocket}.sock`);
    }
    // Validate length
    validateIPCHandleLength(result);
    return result;
}
function validateIPCHandleLength(handle) {
    const limit = safeIpcPathLengths[platform];
    if (typeof limit === 'number' && handle.length >= limit) {
        // https://nodejs.org/api/net.html#net_identifying_paths_for_ipc_connections
        console.warn(`WARNING: IPC handle "${handle}" is longer than ${limit} chars, try a shorter --user-data-dir`);
    }
}
export class Server extends IPCServer {
    static toClientConnectionEvent(server) {
        const onConnection = Event.fromNodeEventEmitter(server, 'connection');
        return Event.map(onConnection, socket => ({
            protocol: new Protocol(new NodeSocket(socket, 'ipc-server-connection')),
            onDidClientDisconnect: Event.once(Event.fromNodeEventEmitter(socket, 'close'))
        }));
    }
    constructor(server) {
        super(Server.toClientConnectionEvent(server));
        this.server = server;
    }
    dispose() {
        super.dispose();
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}
export function serve(hook) {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.on('error', reject);
        server.listen(hook, () => {
            server.removeListener('error', reject);
            resolve(new Server(server));
        });
    });
}
export function connect(hook, clientId) {
    return new Promise((resolve, reject) => {
        let socket;
        const callbackHandler = () => {
            socket.removeListener('error', reject);
            resolve(Client.fromSocket(new NodeSocket(socket, `ipc-client${clientId}`), clientId));
        };
        if (typeof hook === 'string') {
            socket = createConnection(hook, callbackHandler);
        }
        else {
            socket = createConnection(hook, callbackHandler);
        }
        socket.once('error', reject);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXBjLm5ldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3BhcnRzL2lwYy9ub2RlL2lwYy5uZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUVwQyxPQUFPLEVBQStCLGdCQUFnQixFQUFFLFlBQVksRUFBRSxNQUFNLEtBQUssQ0FBQztBQUNsRixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQzVCLE9BQU8sRUFBdUMsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDL0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzlELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDMUQsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLDhCQUE4QixDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUMvQyxPQUFPLEVBQVksUUFBUSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3ZELE9BQU8sRUFBeUIsU0FBUyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDcEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQVcsUUFBUSxFQUEwQyxpQkFBaUIsRUFBOEIsTUFBTSxzQkFBc0IsQ0FBQztBQUVySyxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsR0FBeUIsRUFBRSxNQUFjLEVBQUUsRUFDM0UsVUFBVSxFQUNWLG1CQUFtQixHQUFHLEtBQUssRUFDM0IsMkJBQTJCLEdBQUcsS0FBSyxHQUtu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LENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFFMUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hCLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztDQUNEO0FBRUQsU0FBUyxNQUFNLENBQUMsTUFBZ0IsRUFBRSxJQUFZO0lBQzdDLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ2hCLE9BQU87SUFDUixDQUFDO0lBQ0QsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUM7SUFDcEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzlCLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUNELE1BQU0sTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFDdkIsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUM7SUFDN0MsTUFBTSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLEdBQUcsVUFBVSxDQUFDO0lBQ3RDLE1BQU0sRUFBRSxHQUFHLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxHQUFHLFVBQVUsQ0FBQztJQUN0QyxNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUM7SUFDckMsSUFBSSxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDcEIsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBQ0QsSUFB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