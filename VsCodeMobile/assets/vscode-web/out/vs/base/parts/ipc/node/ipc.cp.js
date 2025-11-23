/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { fork } from 'child_process';
import { createCancelablePromise, Delayer } from '../../../common/async.js';
import { VSBuffer } from '../../../common/buffer.js';
import { CancellationToken } from '../../../common/cancellation.js';
import { isRemoteConsoleLog, log } from '../../../common/console.js';
import * as errors from '../../../common/errors.js';
import { Emitter, Event } from '../../../common/event.js';
import { dispose, toDisposable } from '../../../common/lifecycle.js';
import { deepClone } from '../../../common/objects.js';
import { createQueuedSender } from '../../../node/processes.js';
import { removeDangerousEnvVariables } from '../../../common/processes.js';
import { ChannelClient as IPCClient, ChannelServer as IPCServer } from '../common/ipc.js';
/**
 * This implementation doesn't perform well since it uses base64 encoding for buffers.
 * We should move all implementations to use named ipc.net, so we stop depending on cp.fork.
 */
export class Server extends IPCServer {
    constructor(ctx) {
        super({
            send: r => {
                try {
                    process.send?.(r.buffer.toString('base64'));
                }
                catch (e) { /* not much to do */ }
            },
            onMessage: Event.fromNodeEventEmitter(process, 'message', msg => VSBuffer.wrap(Buffer.from(msg, 'base64')))
        }, ctx);
        process.once('disconnect', () => this.dispose());
    }
}
export class Client {
    constructor(modulePath, options) {
        this.modulePath = modulePath;
        this.options = options;
        this.activeRequests = new Set();
        this.channels = new Map();
        this._onDidProcessExit = new Emitter();
        this.onDidProcessExit = this._onDidProcessExit.event;
        const timeout = options.timeout || 60000;
        this.disposeDelayer = new Delayer(timeout);
        this.child = null;
        this._client = null;
    }
    getChannel(channelName) {
        const that = this;
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        return {
            call(command, arg, cancellationToken) {
                return that.requestPromise(channelName, command, arg, cancellationToken);
            },
            listen(event, arg) {
                return that.requestEvent(channelName, event, arg);
            }
        };
    }
    requestPromise(channelName, name, arg, cancellationToken = CancellationToken.None) {
        if (!this.disposeDelayer) {
            return Promise.reject(new Error('disposed'));
        }
        if (cancellationToken.isCancellationRequested) {
            return Promise.reject(errors.canceled());
        }
        this.disposeDelayer.cancel();
        const channel = this.getCachedChannel(channelName);
        const result = createCancelablePromise(token => channel.call(name, arg, token));
        const cancellationTokenListener = cancellationToken.onCancellationRequested(() => result.cancel());
        const disposable = toDisposable(() => result.cancel());
        this.activeRequests.add(disposable);
        result.finally(() => {
            cancellationTokenListener.dispose();
            this.activeRequests.delete(disposable);
            if (this.activeRequests.size === 0 && this.disposeDelayer) {
                this.disposeDelayer.trigger(() => this.disposeClient());
            }
        });
        return result;
    }
    requestEvent(channelName, name, arg) {
        if (!this.disposeDelayer) {
            return Event.None;
        }
        this.disposeDelayer.cancel();
        let listener;
        const emitter = new Emitter({
            onWillAddFirstListener: () => {
                const channel = this.getCachedChannel(channelName);
                const event = channel.listen(name, arg);
                listener = event(emitter.fire, emitter);
                this.activeRequests.add(listener);
            },
            onDidRemoveLastListener: () => {
                this.activeRequests.delete(listener);
                listener.dispose();
                if (this.activeRequests.size === 0 && this.disposeDelayer) {
                    this.disposeDelayer.trigger(() => this.disposeClient());
                }
            }
        });
        return emitter.event;
    }
    get client() {
        if (!this._client) {
            const args = this.options.args || [];
            const forkOpts = Object.create(null);
            forkOpts.env = { ...deepClone(process.env), 'VSCODE_PARENT_PID': String(process.pid) };
            if (this.options.env) {
                forkOpts.env = { ...forkOpts.env, ...this.options.env };
            }
            if (this.options.freshExecArgv) {
                forkOpts.execArgv = [];
            }
            if (typeof this.options.debug === 'number') {
                forkOpts.execArgv = ['--nolazy', '--inspect=' + this.options.debug];
            }
            if (typeof this.options.debugBrk === 'number') {
                forkOpts.execArgv = ['--nolazy', '--inspect-brk=' + this.options.debugBrk];
            }
            if (forkOpts.execArgv === undefined) {
                forkOpts.execArgv = process.execArgv // if not set, the forked process inherits the execArgv of the parent process
                    .filter(a => !/^--inspect(-brk)?=/.test(a)) // --inspect and --inspect-brk can not be inherited as the port would conflict
                    .filter(a => !a.startsWith('--vscode-')); // --vscode-* arguments are unsupported by node.js and thus need to remove
            }
            removeDangerousEnvVariables(forkOpts.env);
            this.child = fork(this.modulePath, args, forkOpts);
            const onMessageEmitter = new Emitter();
            const onRawMessage = Event.fromNodeEventEmitter(this.child, 'message', msg => msg);
            const rawMessageDisposable = onRawMessage(msg => {
                // Handle remote console logs specially
                if (isRemoteConsoleLog(msg)) {
                    log(msg, `IPC Library: ${this.options.serverName}`);
                    return;
                }
                // Anything else goes to the outside
                onMessageEmitter.fire(VSBuffer.wrap(Buffer.from(msg, 'base64')));
            });
            const sender = this.options.useQueue ? createQueuedSender(this.child) : this.child;
            const send = (r) => this.child?.connected && sender.send(r.buffer.toString('base64'));
            const onMessage = onMessageEmitter.event;
            const protocol = { send, onMessage };
            this._client = new IPCClient(protocol);
            const onExit = () => this.disposeClient();
            process.once('exit', onExit);
            this.child.on('error', err => console.warn('IPC "' + this.options.serverName + '" errored with ' + err));
            this.child.on('exit', (code, signal) => {
                process.removeListener('exit', onExit); // https://github.com/electron/electron/issues/21475
                rawMessageDisposable.dispose();
                this.activeRequests.forEach(r => dispose(r));
                this.activeRequests.clear();
                if (code !== 0 && signal !== 'SIGTERM') {
                    console.warn('IPC "' + this.options.serverName + '" crashed with exit code ' + code + ' and signal ' + signal);
                }
                this.disposeDelayer?.cancel();
                this.disposeClient();
                this._onDidProcessExit.fire({ code, signal });
            });
        }
        return this._client;
    }
    getCachedChannel(name) {
        let channel = this.channels.get(name);
        if (!channel) {
            channel = this.client.getChannel(name);
            this.channels.set(name, channel);
        }
        return channel;
    }
    disposeClient() {
        if (this._client) {
            if (this.child) {
                this.child.kill();
                this.child = null;
            }
            this._client = null;
            this.channels.clear();
        }
    }
    dispose() {
        this._onDidProcessExit.dispose();
        this.disposeDelayer?.cancel();
        this.disposeDelayer = undefined;
        this.disposeClient();
        this.activeRequests.clear();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXBjLmNwLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvcGFydHMvaXBjL25vZGUvaXBjLmNwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBZ0IsSUFBSSxFQUFlLE1BQU0sZUFBZSxDQUFDO0FBQ2hFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxPQUFPLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUM1RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDckQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLEdBQUcsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3JFLE9BQU8sS0FBSyxNQUFNLE1BQU0sMkJBQTJCLENBQUM7QUFDcEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMxRCxPQUFPLEVBQUUsT0FBTyxFQUFlLFlBQVksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ2xGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUN2RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNoRSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMzRSxPQUFPLEVBQUUsYUFBYSxJQUFJLFNBQVMsRUFBRSxhQUFhLElBQUksU0FBUyxFQUE0QixNQUFNLGtCQUFrQixDQUFDO0FBRXBIOzs7R0FHRztBQUVILE1BQU0sT0FBTyxNQUFnQyxTQUFRLFNBQW1CO0lBQ3ZFLFlBQVksR0FBYTtRQUN4QixLQUFLLENBQUM7WUFDTCxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUU7Z0JBQ1QsSUFBSSxDQUFDO29CQUNKLE9BQU8sQ0FBQyxJQUFJLEVB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