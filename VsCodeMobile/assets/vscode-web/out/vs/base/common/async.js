/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationTokenSource } from './cancellation.js';
import { BugIndicatingError, CancellationError } from './errors.js';
import { Emitter, Event } from './event.js';
import { Disposable, DisposableMap, isDisposable, MutableDisposable, toDisposable } from './lifecycle.js';
import { extUri as defaultExtUri } from './resources.js';
import { setTimeout0 } from './platform.js';
import { MicrotaskDelay } from './symbols.js';
import { Lazy } from './lazy.js';
export function isThenable(obj) {
    return !!obj && typeof obj.then === 'function';
}
/**
 * Returns a promise that can be cancelled using the provided cancellation token.
 *
 * @remarks When cancellation is requested, the promise will be rejected with a {@link CancellationError}.
 * If the promise resolves to a disposable object, it will be automatically disposed when cancellation
 * is requested.
 *
 * @param callback A function that accepts a cancellation token and returns a promise
 * @returns A promise that can be cancelled
 */
export function createCancelablePromise(callback) {
    const source = new CancellationTokenSource();
    const thenable = callback(source.token);
    let isCancelled = false;
    const promise = new Promise((resolve, reject) => {
        const subscription = source.token.onCancellationRequested(() => {
            isCancelled = true;
            subscription.dispose();
            reject(new CancellationError());
        });
        Promise.resolve(thenable).then(value => {
            subscription.dispose();
            source.dispose();
            if (!isCancelled) {
                resolve(value);
            }
            else if (isDisposable(value)) {
                // promise has been cancelled, result is disposable and will
                // be cleaned up
                value.dispose();
            }
        }, err => {
            subscription.dispose();
            source.dispose();
            reject(err);
        });
    });
    return new class {
        cancel() {
            source.cancel();
            source.dispose();
        }
        then(resolve, reject) {
            return promise.then(resolve, reject);
        }
        catch(reject) {
            return this.then(undefined, reject);
        }
        finally(onfinally) {
            return promise.finally(onfinally);
        }
    };
}
export function raceCancellation(promise, token, defaultValue) {
    return new Promise((resolve, reject) => {
        const ref = token.onCancellationRequested(() => {
            ref.dispose();
            resolve(defaultValue);
        });
        promise.then(resolve, reject).finally(() => ref.dispose());
    });
}
/**
 * Returns a promise that rejects with an {@CancellationError} as soon as the passed token is cancelled.
 * @see {@link raceCancellation}
 */
export function raceCancellationError(promise, token) {
    return new Promise((resolve, reject) => {
        const ref = token.onCancellationRequested(() => {
            ref.dispose();
            reject(new CancellationError());
        });
        promise.then(resolve, reject).finally(() => ref.dispose());
    });
}
/**
 * Wraps a cancellable promise such that it is no cancellable. Can be used to
 * avoid issues with shared promises that would normally be returned as
 * cancellable to consumers.
 */
export function notCancellablePromise(promise) {
    return new Promise((resolve, reject) => {
        promise.then(resolve, reject);
    });
}
/**
 * Returns as soon as one of the promises resolves or rejects and cancels remaining promises
 */
export function raceCancellablePromises(cancellablePromises) {
    let resolvedPromiseIndex = -1;
    const promises = cancellablePromises.map((promise, index) => promise.then(result => { resolvedPromiseIndex = index; return result; }));
    const promise = Promise.race(promises);
    promise.cancel = () => {
        cancellablePromises.forEach((cancellablePromise, index) => {
            if (index !== resolvedPromiseIndex && cancellablePromise.cancel) {
                cancellablePromise.cancel();
            }
        });
    };
    promise.finally(() => {
        promise.cancel();
    });
    return promise;
}
export function raceTimeout(promise, timeout, onTimeout) {
    let promiseResolve = undefined;
    const timer = setTimeout(() => {
        promiseResolve?.(undefined);
        onTimeout?.();
    }, timeout);
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise(resolve => promiseResolve = resolve)
    ]);
}
export function asPromise(callback) {
    return new Promise((resolve, reject) => {
        const item = callback();
        if (isThenable(item)) {
            item.then(resolve, reject);
        }
        else {
            resolve(item);
        }
    });
}
/**
 * Creates and returns a new promise, plus its `resolve` and `reject` callbacks.
 *
 * Replace with standardized [`Promise.withResolvers`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers) once it is supported
 */
export function promiseWithResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve: resolve, reject: reject };
}
/**
 * A helper to prevent accumulation of sequential async tasks.
 *
 * Imagine a mail man with the sole task of delivering letters. As soon as
 * a letter submitted for delivery, he drives to the destination, delivers it
 * and returns to his base. Imagine that during the trip, N more letters were submitted.
 * When the mail man returns, he picks those N letters and delivers them all in a
 * single trip. Even though N+1 submissions occurred, only 2 deliveries were made.
 *
 * The throttler implements this via the queue() method, by providing it a task
 * factory. Following the example:
 *
 * 		const throttler = new Throttler();
 * 		const letters = [];
 *
 * 		function deliver() {
 * 			const lettersToDeliver = letters;
 * 			letters = [];
 * 			return makeTheTrip(lettersToDeliver);
 * 		}
 *
 * 		function onLetterReceived(l) {
 * 			letters.push(l);
 * 			throttler.queue(deliver);
 * 		}
 */
export class Throttler {
    constructor() {
        this.activePromise = null;
        this.queuedPromise = null;
        this.queuedPromiseFactory = null;
        this.cancellationTokenSource = new CancellationTokenSource();
    }
    queue(promiseFactory) {
        if (this.cancellationTokenSource.token.isCancellationRequested) {
            return Promise.reject(new Error('Throttler is disposed'));
        }
        if (this.activePromise) {
            this.queuedPromiseFactory = promiseFactory;
            if (!this.queuedPromise) {
                const onComplete = () => {
                    this.queuedPromise = null;
                    if (this.cancellationTokenSource.token.isCancellationRequested) {
                        return;
                    }
                    const result = this.queue(this.queuedPromiseFactory);
                    this.queuedPromiseFactory = null;
                    return result;
                };
                this.queuedPromise = new Promise(resolve => {
                    this.activePromise.then(onComplete, onComplete).then(resolve);
                });
            }
            return new Promise((resolve, reject) => {
                this.queuedPromise.then(resolve, reject);
            });
        }
        this.activePromise = promiseFactory(this.cancellationTokenSource.token);
        return new Promise((resolve, reject) => {
            this.activePromise.then((result) => {
                this.activePromise = null;
                resolve(result);
            }, (err) => {
                this.activePromise = null;
                reject(err);
            });
        });
    }
    dispose() {
        this.cancellationTokenSource.cancel();
    }
}
export class Sequencer {
    constructor() {
        this.current = Promise.resolve(null);
    }
    queue(promiseTask) {
        return this.current = this.current.then(() => promiseTask(), () => promiseTask());
    }
}
export class SequencerByKey {
    constructor() {
        this.promiseMap = new Map();
    }
    queue(key, promiseTask) {
        const runningPromise = this.promiseMap.get(key) ?? Promise.resolve();
        const newPromise = runningPromise
            .catch(() => { })
            .then(promiseTask)
            .finally(() => {
            if (this.promiseMap.get(key) === newPromise) {
                this.promiseMap.delete(key);
            }
        });
        this.promiseMap.set(key, newPromise);
        return newPromise;
    }
    peek(key) {
        return this.promiseMap.get(key) || undefined;
    }
    keys() {
        return this.promiseMap.keys();
    }
}
const timeoutDeferred = (timeout, fn) => {
    let scheduled = true;
    const handle = setTimeout(() => {
        scheduled = false;
        fn();
    }, timeout);
    return {
        isTriggered: () => scheduled,
        dispose: () => {
            clearTimeout(handle);
            scheduled = false;
        },
    };
};
const microtaskDeferred = (fn) => {
    let scheduled = true;
    queueMicrotask(() => {
        if (scheduled) {
            scheduled = false;
            fn();
        }
    });
    return {
        isTriggered: () => scheduled,
        dispose: () => { scheduled = false; },
    };
};
/**
 * A helper to delay (debounce) execution of a task that is being requested often.
 *
 * Following the throttler, now imagine the mail man wants to optimize the number of
 * trips proactively. The trip itself can be long, so he decides not to make the trip
 * as soon as a letter is submitted. Instead he waits a while, in case more
 * letters are submitted. After said waiting period, if no letters were submitted, he
 * decides to make the trip. Imagine that N more letters were submitted after the first
 * one, all within a short period of time between each other. Even though N+1
 * submissions occurred, only 1 delivery was made.
 *
 * The delayer offers this behavior via the trigger() method, into which both the task
 * to be executed and the waiting period (delay) must be passed in as arguments. Following
 * the example:
 *
 * 		const delayer = new Delayer(WAITING_PERIOD);
 * 		const letters = [];
 *
 * 		function letterReceived(l) {
 * 			letters.push(l);
 * 			delayer.trigger(() => { return makeTheTrip(); });
 * 		}
 */
export class Delayer {
    constructor(defaultDelay) {
        this.defaultDelay = defaultDelay;
        this.deferred = null;
        this.completionPromise = null;
        this.doResolve = null;
        this.doReject = null;
        this.task = null;
    }
    trigger(task, delay = this.defaultDelay) {
        this.task = task;
        this.cancelTimeout();
        if (!this.completionPromise) {
            this.completionPromise = new Promise((resolve, reject) => {
                this.doResolve = resolve;
                this.doReject = reject;
            }).then(() => {
                this.completionPromise = null;
                this.doResolve = null;
                if (this.task) {
                    const task = this.task;
                    this.task = null;
                    return task();
                }
                return undefined;
            });
        }
        const fn = () => {
            this.deferred = null;
            this.doResolve?.(null);
        };
        this.deferred = delay === MicrotaskDelay ? microtaskDeferred(fn) : timeoutDeferred(delay, fn);
        return this.completionPromise;
    }
    isTriggered() {
        return !!this.deferred?.isTriggered();
    }
    cancel() {
        this.cancelTimeout();
        if (this.completionPromise) {
            this.doReject?.(new CancellationError());
            this.completionPromise = null;
        }
    }
    cancelTimeout() {
        this.deferred?.dispose();
        this.deferred = null;
    }
    dispose() {
        this.cancel();
    }
}
/**
 * A helper to delay execution of a task that is being requested often, while
 * preventing accumulation of consecutive executions, while the task runs.
 *
 * The mail man is clever and waits for a certain amount of time, before going
 * out to deliver letters. While the mail man is going out, more letters arrive
 * and can only be delivered once he is back. Once he is back the mail man will
 * do one more trip to deliver the letters that have accumulated while he was out.
 */
export class ThrottledDelayer {
    constructor(defaultDelay) {
        this.delayer = new Delayer(defaultDelay);
        this.throttler = new Throttler();
    }
    trigger(promiseFactory, delay) {
        return this.delayer.trigger(() => this.throttler.queue(promiseFactory), delay);
    }
    isTriggered() {
        return this.delayer.isTriggered();
    }
    cancel() {
        this.delayer.cancel();
    }
    dispose() {
        this.delayer.dispose();
        this.throttler.dispose();
    }
}
/**
 * A barrier that is initially closed and then becomes opened permanently.
 */
export class Barrier {
    constructor() {
        this._isOpen = false;
        this._promise = new Promise((c, e) => {
            this._completePromise = c;
        });
    }
    isOpen() {
        return this._isOpen;
    }
    open() {
        this._isOpen = true;
        this._completePromise(true);
    }
    wait() {
        return this._promise;
    }
}
/**
 * A barrier that is initially closed and then becomes opened permanently after a certain period of
 * time or when open is called explicitly
 */
export class AutoOpenBarrier extends Barrier {
    constructor(autoOpenTimeMs) {
        super();
        this._timeout = setTimeout(() => this.open(), autoOpenTimeMs);
    }
    open() {
        clearTimeout(this._timeout);
        super.open();
    }
}
export function timeout(millis, token) {
    if (!token) {
        return createCancelablePromise(token => timeout(millis, token));
    }
    return new Promise((resolve, reject) => {
        const handle = setTimeout(() => {
            disposable.dispose();
            resolve();
        }, millis);
        const disposable = token.onCancellationRequested(() => {
            clearTimeout(handle);
            disposable.dispose();
            reject(new CancellationError());
        });
    });
}
/**
 * Creates a timeout that can be disposed using its returned value.
 * @param handler The timeout handler.
 * @param timeout An optional timeout in milliseconds.
 * @param store An optional {@link DisposableStore} that will have the timeout disposable managed automatically.
 *
 * @example
 * const store = new DisposableStore;
 * // Call the timeout after 1000ms at which point it will be automatically
 * // evicted from the store.
 * const timeoutDisposable = disposableTimeout(() => {}, 1000, store);
 *
 * if (foo) {
 *   // Cancel the timeout and evict it from store.
 *   timeoutDisposable.dispose();
 * }
 */
export function disposableTimeout(handler, timeout = 0, store) {
    const timer = setTimeout(() => {
        handler();
        if (store) {
            disposable.dispose();
        }
    }, timeout);
    const disposable = toDisposable(() => {
        clearTimeout(timer);
        store?.delete(disposable);
    });
    store?.add(disposable);
    return disposable;
}
/**
 * Runs the provided list of promise factories in sequential order. The returned
 * promise will complete to an array of results from each promise.
 */
export function sequence(promiseFactories) {
    const results = [];
    let index = 0;
    const len = promiseFactories.length;
    function next() {
        return index < len ? promiseFactories[index++]() : null;
    }
    function thenHandler(result) {
        if (result !== undefined && result !== null) {
            results.push(result);
        }
        const n = next();
        if (n) {
            return n.then(thenHandler);
        }
        return Promise.resolve(results);
    }
    return Promise.resolve(null).then(thenHandler);
}
export function first(promiseFactories, shouldStop = t => !!t, defaultValue = null) {
    let index = 0;
    const len = promiseFactories.length;
    const loop = () => {
        if (index >= len) {
            return Promise.resolve(defaultValue);
        }
        const factory = promiseFactories[index++];
        const promise = Promise.resolve(factory());
        return promise.then(result => {
            if (shouldStop(result)) {
                return Promise.resolve(result);
            }
            return loop();
        });
    };
    return loop();
}
export function firstParallel(promiseList, shouldStop = t => !!t, defaultValue = null) {
    if (promiseList.length === 0) {
        return Promise.resolve(defaultValue);
    }
    let todo = promiseList.length;
    const finish = () => {
        todo = -1;
        for (const promise of promiseList) {
            promise.cancel?.();
        }
    };
    return new Promise((resolve, reject) => {
        for (const promise of promiseList) {
            promise.then(result => {
                if (--todo >= 0 && shouldStop(result)) {
                    finish();
                    resolve(result);
                }
                else if (todo === 0) {
                    resolve(defaultValue);
                }
            })
                .catch(err => {
                if (--todo >= 0) {
                    finish();
                    reject(err);
                }
            });
        }
    });
}
/**
 * A helper to queue N promises and run them all with a max degree of parallelism. The helper
 * ensures that at any time no more than M promises are running at the same time.
 */
export class Limiter {
    constructor(maxDegreeOfParalellism) {
        this._size = 0;
        this._isDisposed = false;
        this.maxDegreeOfParalellism = maxDegreeOfParalellism;
        this.outstandingPromises = [];
        this.runningPromises = 0;
        this._onDrained = new Emitter();
    }
    /**
     *
     * @returns A promise that resolved when all work is done (onDrained) or when
     * there is nothing to do
     */
    whenIdle() {
        return this.size > 0
            ? Event.toPromise(this.onDrained)
            : Promise.resolve();
    }
    get onDrained() {
        return this._onDrained.event;
    }
    get size() {
        return this._size;
    }
    queue(factory) {
        if (this._isDisposed) {
            throw new Error('Object has been disposed');
        }
        this._size++;
        return new Promise((c, e) => {
            this.outstandingPromises.push({ factory, c, e });
            this.consume();
        });
    }
    consume() {
        while (this.outstandingPromises.length && this.runningPromises < this.maxDegreeOfParalellism) {
            const iLimitedTask = this.outstandingPromises.shift();
            this.runningPromises++;
            const promise = iLimitedTask.factory();
            promise.then(iLimitedTask.c, iLimitedTask.e);
            promise.then(() => this.consumed(), () => this.consumed());
        }
    }
    consumed() {
        if (this._isDisposed) {
            return;
        }
        this.runningPromises--;
        if (--this._size === 0) {
            this._onDrained.fire();
        }
        if (this.outstandingPromises.length > 0) {
            this.consume();
        }
    }
    clear() {
        if (this._isDisposed) {
            throw new Error('Object has been disposed');
        }
        this.outstandingPromises.length = 0;
        this._size = this.runningPromises;
    }
    dispose() {
        this._isDisposed = true;
        this.outstandingPromises.length = 0; // stop further processing
        this._size = 0;
        this._onDrained.dispose();
    }
}
/**
 * A queue is handles one promise at a time and guarantees that at any time only one promise is executing.
 */
export class Queue extends Limiter {
    constructor() {
        super(1);
    }
}
/**
 * Same as `Queue`, ensures that only 1 task is executed at the same time. The difference to `Queue` is that
 * there is only 1 task about to be scheduled next. As such, calling `queue` while a task is executing will
 * replace the currently queued task until it executes.
 *
 * As such, the returned promise may not be from the factory that is passed in but from the next factory that
 * is running after having called `queue`.
 */
export class LimitedQueue {
    constructor() {
        this.sequentializer = new TaskSequentializer();
        this.tasks = 0;
    }
    queue(factory) {
        if (!this.sequentializer.isRunning()) {
            return this.sequentializer.run(this.tasks++, factory());
        }
        return this.sequentializer.queue(() => {
            return this.sequentializer.run(this.tasks++, factory());
        });
    }
}
/**
 * A helper to organize queues per resource. The ResourceQueue makes sure to manage queues per resource
 * by disposing them once the queue is empty.
 */
export class ResourceQueue {
    constructor() {
        this.queues = new Map();
        this.drainers = new Set();
        this.drainListeners = undefined;
        this.drainListenerCount = 0;
    }
    async whenDrained() {
        if (this.isDrained()) {
            return;
        }
        const promise = new DeferredPromise();
        this.drainers.add(promise);
        return promise.p;
    }
    isDrained() {
        for (const [, queue] of this.queues) {
            if (queue.size > 0) {
                return false;
            }
        }
        return true;
    }
    queueSize(resource, extUri = defaultExtUri) {
        const key = extUri.getComparisonKey(resource);
        return this.queues.get(key)?.size ?? 0;
    }
    queueFor(resource, factory, extUri = defaultExtUri) {
        const key = extUri.getComparisonKey(resource);
        let queue = this.queues.get(key);
        if (!queue) {
            queue = new Queue();
            const drainListenerId = this.drainListenerCount++;
            const drainListener = Event.once(queue.onDrained)(() => {
                queue?.dispose();
                this.queues.delete(key);
                this.onDidQueueDrain();
                this.drainListeners?.deleteAndDispose(drainListenerId);
                if (this.drainListeners?.size === 0) {
                    this.drainListeners.dispose();
                    this.drainListeners = undefined;
                }
            });
            if (!this.drainListeners) {
                this.drainListeners = new DisposableMap();
            }
            this.drainListeners.set(drainListenerId, drainListener);
            this.queues.set(key, queue);
        }
        return queue.queue(factory);
    }
    onDidQueueDrain() {
        if (!this.isDrained()) {
            return; // not done yet
        }
        this.releaseDrainers();
    }
    releaseDrainers() {
        for (const drainer of this.drainers) {
            drainer.complete();
        }
        this.drainers.clear();
    }
    dispose() {
        for (const [, queue] of this.queues) {
            queue.dispose();
        }
        this.queues.clear();
        // Even though we might still have pending
        // tasks queued, after the queues have been
        // disposed, we can no longer track them, so
        // we release drainers to prevent hanging
        // promises when the resource queue is being
        // disposed.
        this.releaseDrainers();
        this.drainListeners?.dispose();
    }
}
/**
 * Processes tasks in the order they were scheduled.
*/
export class TaskQueue {
    constructor() {
        this._runningTask = undefined;
        this._pendingTasks = [];
    }
    /**
     * Waits for the current and pending tasks to finish, then runs and awaits the given task.
     * If the task is skipped because of clearPending, the promise is rejected with a CancellationError.
    */
    schedule(task) {
        const deferred = new DeferredPromise();
        this._pendingTasks.push({ task, deferred, setUndefinedWhenCleared: false });
        this._runIfNotRunning();
        return deferred.p;
    }
    /**
     * Waits for the current and pending tasks to finish, then runs and awaits the given task.
     * If the task is skipped because of clearPending, the promise is resolved with undefined.
    */
    scheduleSkipIfCleared(task) {
        const deferred = new DeferredPromise();
        this._pendingTasks.push({ task, deferred, setUndefinedWhenCleared: true });
        this._runIfNotRunning();
        return deferred.p;
    }
    _runIfNotRunning() {
        if (this._runningTask === undefined) {
            this._processQueue();
        }
    }
    async _processQueue() {
        if (this._pendingTasks.length === 0) {
            return;
        }
        const next = this._pendingTasks.shift();
        if (!next) {
            return;
        }
        if (this._runningTask) {
            throw new BugIndicatingError();
        }
        this._runningTask = next.task;
        try {
            const result = await next.task();
            next.deferred.complete(result);
        }
        catch (e) {
            next.deferred.error(e);
        }
        finally {
            this._runningTask = undefined;
            this._processQueue();
        }
    }
    /**
     * Clears all pending tasks. Does not cancel the currently running task.
    */
    clearPending() {
        const tasks = this._pendingTasks;
        this._pendingTasks = [];
        for (const task of tasks) {
            if (task.setUndefinedWhenCleared) {
                task.deferred.complete(undefined);
            }
            else {
                task.deferred.error(new CancellationError());
            }
        }
    }
}
export class TimeoutTimer {
    constructor(runner, timeout) {
        this._isDisposed = false;
        this._token = undefined;
        if (typeof runner === 'function' && typeof timeout === 'number') {
            this.setIfNotSet(runner, timeout);
        }
    }
    dispose() {
        this.cancel();
        this._isDisposed = true;
    }
    cancel() {
        if (this._token !== undefined) {
            clearTimeout(this._token);
            this._token = undefined;
        }
    }
    cancelAndSet(runner, timeout) {
        if (this._isDisposed) {
            throw new BugIndicatingError(`Calling 'cancelAndSet' on a disposed TimeoutTimer`);
        }
        this.cancel();
        this._token = setTimeout(() => {
            this._token = undefined;
            runner();
        }, timeout);
    }
    setIfNotSet(runner, timeout) {
        if (this._isDisposed) {
            throw new BugIndicatingError(`Calling 'setIfNotSet' on a disposed TimeoutTimer`);
        }
        if (this._token !== undefined) {
            // timer is already set
            return;
        }
        this._token = setTimeout(() => {
            this._token = undefined;
            runner();
        }, timeout);
    }
}
export class IntervalTimer {
    constructor() {
        this.disposable = undefined;
        this.isDisposed = false;
    }
    cancel() {
        this.disposable?.dispose();
        this.disposable = undefined;
    }
    cancelAndSet(runner, interval, context = globalThis) {
        if (this.isDisposed) {
            throw new BugIndicatingError(`Calling 'cancelAndSet' on a disposed IntervalTimer`);
        }
        this.cancel();
        const handle = context.setInterval(() => {
            runner();
        }, interval);
        this.disposable = toDisposable(() => {
            context.clearInterval(handle);
            this.disposable = undefined;
        });
    }
    dispose() {
        this.cancel();
        this.isDisposed = true;
    }
}
export class RunOnceScheduler {
    constructor(runner, delay) {
        this.timeoutToken = undefined;
        this.runner = runner;
        this.timeout = delay;
        this.timeoutHandler = this.onTimeout.bind(this);
    }
    /**
     * Dispose RunOnceScheduler
     */
    dispose() {
        this.cancel();
        this.runner = null;
    }
    /**
     * Cancel current scheduled runner (if any).
     */
    cancel() {
        if (this.isScheduled()) {
            clearTimeout(this.timeoutToken);
            this.timeoutToken = undefined;
        }
    }
    /**
     * Cancel previous runner (if any) & schedule a new runner.
     */
    schedule(delay = this.timeout) {
        this.cancel();
        this.timeoutToken = setTimeout(this.timeoutHandler, delay);
    }
    get delay() {
        return this.timeout;
    }
    set delay(value) {
        this.timeout = value;
    }
    /**
     * Returns true if scheduled.
     */
    isScheduled() {
        return this.timeoutToken !== undefined;
    }
    flush() {
        if (this.isScheduled()) {
            this.cancel();
            this.doRun();
        }
    }
    onTimeout() {
        this.timeoutToken = undefined;
        if (this.runner) {
            this.doRun();
        }
    }
    doRun() {
        this.runner?.();
    }
}
/**
 * Same as `RunOnceScheduler`, but doesn't count the time spent in sleep mode.
 * > **NOTE**: Only offers 1s resolution.
 *
 * When calling `setTimeout` with 3hrs, and putting the computer immediately to sleep
 * for 8hrs, `setTimeout` will fire **as soon as the computer wakes from sleep**. But
 * this scheduler will execute 3hrs **after waking the computer from sleep**.
 */
export class ProcessTimeRunOnceScheduler {
    constructor(runner, delay) {
        if (delay % 1000 !== 0) {
            console.warn(`ProcessTimeRunOnceScheduler resolution is 1s, ${delay}ms is not a multiple of 1000ms.`);
        }
        this.runner = runner;
        this.timeout = delay;
        this.counter = 0;
        this.intervalToken = undefined;
        this.intervalHandler = this.onInterval.bind(this);
    }
    dispose() {
        this.cancel();
        this.runner = null;
    }
    cancel() {
        if (this.isScheduled()) {
            clearInterval(this.intervalToken);
            this.intervalToken = undefined;
        }
    }
    /**
     * Cancel previous runner (if any) & schedule a new runner.
     */
    schedule(delay = this.timeout) {
        if (delay % 1000 !== 0) {
            console.warn(`ProcessTimeRunOnceScheduler resolution is 1s, ${delay}ms is not a multiple of 1000ms.`);
        }
        this.cancel();
        this.counter = Math.ceil(delay / 1000);
        this.intervalToken = setInterval(this.intervalHandler, 1000);
    }
    /**
     * Returns true if scheduled.
     */
    isScheduled() {
        return this.intervalToken !== undefined;
    }
    onInterval() {
        this.counter--;
        if (this.counter > 0) {
            // still need to wait
            return;
        }
        // time elapsed
        clearInterval(this.intervalToken);
        this.intervalToken = undefined;
        this.runner?.();
    }
}
export class RunOnceWorker extends RunOnceScheduler {
    constructor(runner, timeout) {
        super(runner, timeout);
        this.units = [];
    }
    work(unit) {
        this.units.push(unit);
        if (!this.isScheduled()) {
            this.schedule();
        }
    }
    doRun() {
        const units = this.units;
        this.units = [];
        this.runner?.(units);
    }
    dispose() {
        this.units = [];
        super.dispose();
    }
}
/**
 * The `ThrottledWorker` will accept units of work `T`
 * to handle. The contract is:
 * * there is a maximum of units the worker can handle at once (via `maxWorkChunkSize`)
 * * there is a maximum of units the worker will keep in memory for processing (via `maxBufferedWork`)
 * * after having handled `maxWorkChunkSize` units, the worker needs to rest (via `throttleDelay`)
 */
export class ThrottledWorker extends Disposable {
    constructor(options, handler) {
        super();
        this.options = options;
        this.handler = handler;
        this.pendingWork = [];
        this.throttler = this._register(new MutableDisposable());
        this.disposed = false;
        this.lastExecutionTime = 0;
    }
    /**
     * The number of work units that are pending to be processed.
     */
    get pending() { return this.pendingWork.length; }
    /**
     * Add units to be worked on. Use `pending` to figure out
     * how many units are not yet processed after this method
     * was called.
     *
     * @returns whether the work was accepted or not. If the
     * worker is disposed, it will not accept any more work.
     * If the number of pending units would become larger
     * than `maxPendingWork`, more work will also not be accepted.
     */
    work(units) {
        if (this.disposed) {
            return false; // work not accepted: disposed
        }
        // Check for reaching maximum of pending work
        if (typeof this.options.maxBufferedWork === 'number') {
            // Throttled: simple check if pending + units exceeds max pending
            if (this.throttler.value) {
                if (this.pending + units.length > this.options.maxBufferedWork) {
                    return false; // work not accepted: too much pending work
                }
            }
            // Unthrottled: same as throttled, but account for max chunk getting
            // worked on directly without being pending
            else {
                if (this.pending + units.length - this.options.maxWorkChunkSize > this.options.maxBufferedWork) {
                    return false; // work not accepted: too much pending work
                }
            }
        }
        // Add to pending units first
        for (const unit of units) {
            this.pendingWork.push(unit);
        }
        const timeSinceLastExecution = Date.now() - this.lastExecutionTime;
        if (!this.throttler.value && (!this.options.waitThrottleDelayBetweenWorkUnits || timeSinceLastExecution >= this.options.throttleDelay)) {
            // Work directly if we are not throttling and we are not
            // enforced to throttle between `work()` calls.
            this.doWork();
        }
        else if (!this.throttler.value && this.options.waitThrottleDelayBetweenWorkUnits) {
            // Otherwise, schedule the throttler to work.
            this.scheduleThrottler(Math.max(this.options.throttleDelay - timeSinceLastExecution, 0));
        }
        else {
            // Otherwise, our work will be picked up by the running throttler
        }
        return true; // work accepted
    }
    doWork() {
        this.lastExecutionTime = Date.now();
        // Extract chunk to handle and handle it
        this.handler(this.pendingWork.splice(0, this.options.maxWorkChunkSize));
        // If we have remaining work, schedule it after a delay
        if (this.pendingWork.length > 0) {
            this.scheduleThrottler();
        }
    }
    scheduleThrottler(delay = this.options.throttleDelay) {
        this.throttler.value = new RunOnceScheduler(() => {
            this.throttler.clear();
            this.doWork();
        }, delay);
        this.throttler.value.schedule();
    }
    dispose() {
        super.dispose();
        this.pendingWork.length = 0;
        this.disposed = true;
    }
}
/**
 * Execute the callback the next time the browser is idle, returning an
 * {@link IDisposable} that will cancel the callback when disposed. This wraps
 * [requestIdleCallback] so it will fallback to [setTimeout] if the environment
 * doesn't support it.
 *
 * @param callback The callback to run when idle, this includes an
 * [IdleDeadline] that provides the time alloted for the idle callback by the
 * browser. Not respecting this deadline will result in a degraded user
 * experience.
 * @param timeout A timeout at which point to queue no longer wait for an idle
 * callback but queue it on the regular event loop (like setTimeout). Typically
 * this should not be used.
 *
 * [IdleDeadline]: https://developer.mozilla.org/en-US/docs/Web/API/IdleDeadline
 * [requestIdleCallback]: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
 * [setTimeout]: https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
 *
 * **Note** that there is `dom.ts#runWhenWindowIdle` which is better suited when running inside a browser
 * context
 */
export let runWhenGlobalIdle;
export let _runWhenIdle;
(function () {
    const safeGlobal = globalThis;
    if (typeof safeGlobal.requestIdleCallback !== 'function' || typeof safeGlobal.cancelIdleCallback !== 'function') {
        _runWhenIdle = (_targetWindow, runner, timeout) => {
            setTimeout0(() => {
                if (disposed) {
                    return;
                }
                const end = Date.now() + 15; // one frame at 64fps
                const deadline = {
                    didTimeout: true,
                    timeRemaining() {
                        return Math.max(0, end - Date.now());
                    }
                };
                runner(Object.freeze(deadline));
            });
            let disposed = false;
            return {
                dispose() {
                    if (disposed) {
                        return;
                    }
                    disposed = true;
                }
            };
        };
    }
    else {
        _runWhenIdle = (targetWindow, runner, timeout) => {
            const handle = targetWindow.requestIdleCallback(runner, typeof timeout === 'number' ? { timeout } : undefined);
            let disposed = false;
            return {
                dispose() {
                    if (disposed) {
                        return;
                    }
                    disposed = true;
                    targetWindow.cancelIdleCallback(handle);
                }
            };
        };
    }
    runWhenGlobalIdle = (runner, timeout) => _runWhenIdle(globalThis, runner, timeout);
})();
export class AbstractIdleValue {
    constructor(targetWindow, executor) {
        this._didRun = false;
        this._executor = () => {
            try {
                this._value = executor();
            }
            catch (err) {
                this._error = err;
            }
            finally {
                this._didRun = true;
            }
        };
        this._handle = _runWhenIdle(targetWindow, () => this._executor());
    }
    dispose() {
        this._handle.dispose();
    }
    get value() {
        if (!this._didRun) {
            this._handle.dispose();
            this._executor();
        }
        if (this._error) {
            throw this._error;
        }
        return this._value;
    }
    get isInitialized() {
        return this._didRun;
    }
}
/**
 * An `IdleValue` that always uses the current window (which might be throttled or inactive)
 *
 * **Note** that there is `dom.ts#WindowIdleValue` which is better suited when running inside a browser
 * context
 */
export class GlobalIdleValue extends AbstractIdleValue {
    constructor(executor) {
        super(globalThis, executor);
    }
}
//#endregion
export async function retry(task, delay, retries) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await task();
        }
        catch (error) {
            lastError = error;
            await timeout(delay);
        }
    }
    throw lastError;
}
/**
 * @deprecated use `LimitedQueue` instead for an easier to use API
 */
export class TaskSequentializer {
    isRunning(taskId) {
        if (typeof taskId === 'number') {
            return this._running?.taskId === taskId;
        }
        return !!this._running;
    }
    get running() {
        return this._running?.promise;
    }
    cancelRunning() {
        this._running?.cancel();
    }
    run(taskId, promise, onCancel) {
        this._running = { taskId, cancel: () => onCancel?.(), promise };
        promise.then(() => this.doneRunning(taskId), () => this.doneRunning(taskId));
        return promise;
    }
    doneRunning(taskId) {
        if (this._running && taskId === this._running.taskId) {
            // only set running to done if the promise finished that is associated with that taskId
            this._running = undefined;
            // schedule the queued task now that we are free if we have any
            this.runQueued();
        }
    }
    runQueued() {
        if (this._queued) {
            const queued = this._queued;
            this._queued = undefined;
            // Run queued task and complete on the associated promise
            queued.run().then(queued.promiseResolve, queued.promiseReject);
        }
    }
    /**
     * Note: the promise to schedule as next run MUST itself call `run`.
     *       Otherwise, this sequentializer will report `false` for `isRunning`
     *       even when this task is running. Missing this detail means that
     *       suddenly multiple tasks will run in parallel.
     */
    queue(run) {
        // this is our first queued task, so we create associated promise with it
        // so that we can return a promise that completes when the task has
        // completed.
        if (!this._queued) {
            const { promise, resolve: promiseResolve, reject: promiseReject } = promiseWithResolvers();
            this._queued = {
                run,
                promise,
                promiseResolve,
                promiseReject
            };
        }
        // we have a previous queued task, just overwrite it
        else {
            this._queued.run = run;
        }
        return this._queued.promise;
    }
    hasQueued() {
        return !!this._queued;
    }
    async join() {
        return this._queued?.promise ?? this._running?.promise;
    }
}
//#endregion
//#region
/**
 * The `IntervalCounter` allows to count the number
 * of calls to `increment()` over a duration of
 * `interval`. This utility can be used to conditionally
 * throttle a frequent task when a certain threshold
 * is reached.
 */
export class IntervalCounter {
    constructor(interval, nowFn = () => Date.now()) {
        this.interval = interval;
        this.nowFn = nowFn;
        this.lastIncrementTime = 0;
        this.value = 0;
    }
    increment() {
        const now = this.nowFn();
        // We are outside of the range of `interval` and as such
        // start counting from 0 and remember the time
        if (now - this.lastIncrementTime > this.interval) {
            this.lastIncrementTime = now;
            this.value = 0;
        }
        this.value++;
        return this.value;
    }
}
var DeferredOutcome;
(function (DeferredOutcome) {
    DeferredOutcome[DeferredOutcome["Resolved"] = 0] = "Resolved";
    DeferredOutcome[DeferredOutcome["Rejected"] = 1] = "Rejected";
})(DeferredOutcome || (DeferredOutcome = {}));
/**
 * Creates a promise whose resolution or rejection can be controlled imperatively.
 */
export class DeferredPromise {
    static fromPromise(promise) {
        const deferred = new DeferredPromise();
        deferred.settleWith(promise);
        return deferred;
    }
    get isRejected() {
        return this.outcome?.outcome === 1 /* DeferredOutcome.Rejected */;
    }
    get isResolved() {
        return this.outcome?.outcome === 0 /* DeferredOutcome.Resolved */;
    }
    get isSettled() {
        return !!this.outcome;
    }
    get value() {
        return this.outcome?.outcome === 0 /* DeferredOutcome.Resolved */ ? this.outcome?.value : undefined;
    }
    constructor() {
        this.p = new Promise((c, e) => {
            this.completeCallback = c;
            this.errorCallback = e;
        });
    }
    complete(value) {
        if (this.isSettled) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this.completeCallback(value);
            this.outcome = { outcome: 0 /* DeferredOutcome.Resolved */, value };
            resolve();
        });
    }
    error(err) {
        if (this.isSettled) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this.errorCallback(err);
            this.outcome = { outcome: 1 /* DeferredOutcome.Rejected */, value: err };
            resolve();
        });
    }
    settleWith(promise) {
        return promise.then(value => this.complete(value), error => this.error(error));
    }
    cancel() {
        return this.error(new CancellationError());
    }
}
//#endregion
//#region Promises
export var Promises;
(function (Promises) {
    /**
     * A drop-in replacement for `Promise.all` with the only difference
     * that the method awaits every promise to either fulfill or reject.
     *
     * Similar to `Promise.all`, only the first error will be returned
     * if any.
     */
    async function settled(promises) {
        let firstError = undefined;
        const result = await Promise.all(promises.map(promise => promise.then(value => value, error => {
            if (!firstError) {
                firstError = error;
            }
            return undefined; // do not rethrow so that other promises can settle
        })));
        if (typeof firstError !== 'undefined') {
            throw firstError;
        }
        return result; // cast is needed and protected by the `throw` above
    }
    Promises.settled = settled;
    /**
     * A helper to create a new `Promise<T>` with a body that is a promise
     * itself. By default, an error that raises from the async body will
     * end up as a unhandled rejection, so this utility properly awaits the
     * body and rejects the promise as a normal promise does without async
     * body.
     *
     * This method should only be used in rare cases where otherwise `async`
     * cannot be used (e.g. when callbacks are involved that require this).
     */
    function withAsyncBody(bodyFn) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            try {
                await bodyFn(resolve, reject);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    Promises.withAsyncBody = withAsyncBody;
})(Promises || (Promises = {}));
export class StatefulPromise {
    get value() { return this._value; }
    get error() { return this._error; }
    get isResolved() { return this._isResolved; }
    constructor(promise) {
        this._value = undefined;
        this._error = undefined;
        this._isResolved = false;
        this.promise = promise.then(value => {
            this._value = value;
            this._isResolved = true;
            return value;
        }, error => {
            this._error = error;
            this._isResolved = true;
            throw error;
        });
    }
    /**
     * Returns the resolved value.
     * Throws if the promise is not resolved yet.
     */
    requireValue() {
        if (!this._isResolved) {
            throw new BugIndicatingError('Promise is not resolved yet');
        }
        if (this._error) {
            throw this._error;
        }
        return this._value;
    }
}
export class LazyStatefulPromise {
    constructor(_compute) {
        this._compute = _compute;
        this._promise = new Lazy(() => new StatefulPromise(this._compute()));
    }
    /**
     * Returns the resolved value.
     * Throws if the promise is not resolved yet.
     */
    requireValue() {
        return this._promise.value.requireValue();
    }
    /**
     * Returns the promise (and triggers a computation of the promise if not yet done so).
     */
    getPromise() {
        return this._promise.value.promise;
    }
    /**
     * Reads the current value without triggering a computation of the promise.
     */
    get currentValue() {
        return this._promise.rawValue?.value;
    }
}
//#endregion
//#region
var AsyncIterableSourceState;
(function (AsyncIterableSourceState) {
    AsyncIterableSourceState[AsyncIterableSourceState["Initial"] = 0] = "Initial";
    AsyncIterableSourceState[AsyncIterableSourceState["DoneOK"] = 1] = "DoneOK";
    AsyncIterableSourceState[AsyncIterableSourceState["DoneError"] = 2] = "DoneError";
})(AsyncIterableSourceState || (AsyncIterableSourceState = {}));
/**
 * A rich implementation for an `AsyncIterable<T>`.
 */
export class AsyncIterableObject {
    static fromArray(items) {
        return new AsyncIterableObject((writer) => {
            writer.emitMany(items);
        });
    }
    static fromPromise(promise) {
        return new AsyncIterableObject(async (emitter) => {
            emitter.emitMany(await promise);
        });
    }
    static fromPromisesResolveOrder(promises) {
        return new AsyncIterableObject(async (emitter) => {
            await Promise.all(promises.map(async (p) => emitter.emitOne(await p)));
        });
    }
    static merge(iterables) {
        return new AsyncIterableObject(async (emitter) => {
            await Promise.all(iterables.map(async (iterable) => {
                for await (const item of iterable) {
                    emitter.emitOne(item);
                }
            }));
        });
    }
    static { this.EMPTY = AsyncIterableObject.fromArray([]); }
    constructor(executor, onReturn) {
        this._state = 0 /* AsyncIterableSourceState.Initial */;
        this._results = [];
        this._error = null;
        this._onReturn = onReturn;
        this._onStateChanged = new Emitter();
        queueMicrotask(async () => {
            const writer = {
                emitOne: (item) => this.emitOne(item),
                emitMany: (items) => this.emitMany(items),
                reject: (error) => this.reject(error)
            };
            try {
                await Promise.resolve(executor(writer));
                this.resolve();
            }
            catch (err) {
                this.reject(err);
            }
            finally {
                writer.emitOne = undefined;
                writer.emitMany = undefined;
                writer.reject = undefined;
            }
        });
    }
    [Symbol.asyncIterator]() {
        let i = 0;
        return {
            next: async () => {
                do {
                    if (this._state === 2 /* AsyncIterableSourceState.DoneError */) {
                        throw this._error;
                    }
                    if (i < this._results.length) {
                        return { done: false, value: this._results[i++] };
                    }
                    if (this._state === 1 /* AsyncIterableSourceState.DoneOK */) {
                        return { done: true, value: undefined };
                    }
                    await Event.toPromise(this._onStateChanged.event);
                } while (true);
            },
            return: async () => {
                this._onReturn?.();
                return { done: true, value: undefined };
            }
        };
    }
    static map(iterable, mapFn) {
        return new AsyncIterableObject(async (emitter) => {
            for await (const item of iterable) {
                emitter.emitOne(mapFn(item));
            }
        });
    }
    map(mapFn) {
        return AsyncIterableObject.map(this, mapFn);
    }
    static filter(iterable, filterFn) {
        return new AsyncIterableObject(async (emitter) => {
            for await (const item of iterable) {
                if (filterFn(item)) {
                    emitter.emitOne(item);
                }
            }
        });
    }
    filter(filterFn) {
        return AsyncIterableObject.filter(this, filterFn);
    }
    static coalesce(iterable) {
        return AsyncIterableObject.filter(iterable, item => !!item);
    }
    coalesce() {
        return AsyncIterableObject.coalesce(this);
    }
    static async toPromise(iterable) {
        const result = [];
        for await (const item of iterable) {
            result.push(item);
        }
        return result;
    }
    toPromise() {
        return AsyncIterableObject.toPromise(this);
    }
    /**
     * The value will be appended at the end.
     *
     * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
     */
    emitOne(value) {
        if (this._state !== 0 /* AsyncIterableSourceState.Initial */) {
            return;
        }
        // it is important to add new values at the end,
        // as we may have iterators already running on the array
        this._results.push(value);
        this._onStateChanged.fire();
    }
    /**
     * The values will be appended at the end.
     *
     * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
     */
    emitMany(values) {
        if (this._state !== 0 /* AsyncIterableSourceState.Initial */) {
            return;
        }
        // it is important to add new values at the end,
        // as we may have iterators already running on the array
        this._results = this._results.concat(values);
        this._onStateChanged.fire();
    }
    /**
     * Calling `resolve()` will mark the result array as complete.
     *
     * **NOTE** `resolve()` must be called, otherwise all consumers of this iterable will hang indefinitely, similar to a non-resolved promise.
     * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
     */
    resolve() {
        if (this._state !== 0 /* AsyncIterableSourceState.Initial */) {
            return;
        }
        this._state = 1 /* AsyncIterableSourceState.DoneOK */;
        this._onStateChanged.fire();
    }
    /**
     * Writing an error will permanently invalidate this iterable.
     * The current users will receive an error thrown, as will all future users.
     *
     * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
     */
    reject(error) {
        if (this._state !== 0 /* AsyncIterableSourceState.Initial */) {
            return;
        }
        this._state = 2 /* AsyncIterableSourceState.DoneError */;
        this._error = error;
        this._onStateChanged.fire();
    }
}
export function createCancelableAsyncIterableProducer(callback) {
    const source = new CancellationTokenSource();
    const innerIterable = callback(source.token);
    return new CancelableAsyncIterableProducer(source, async (emitter) => {
        const subscription = source.token.onCancellationRequested(() => {
            subscription.dispose();
            source.dispose();
            emitter.reject(new CancellationError());
        });
        try {
            for await (const item of innerIterable) {
                if (source.token.isCancellationRequested) {
                    // canceled in the meantime
                    return;
                }
                emitter.emitOne(item);
            }
            subscription.dispose();
            source.dispose();
        }
        catch (err) {
            subscription.dispose();
            source.dispose();
            emitter.reject(err);
        }
    });
}
export class AsyncIterableSource {
    /**
     *
     * @param onReturn A function that will be called when consuming the async iterable
     * has finished by the consumer, e.g the for-await-loop has be existed (break, return) early.
     * This is NOT called when resolving this source by its owner.
     */
    constructor(onReturn) {
        this._deferred = new DeferredPromise();
        this._asyncIterable = new AsyncIterableObject(emitter => {
            if (earlyError) {
                emitter.reject(earlyError);
                return;
            }
            if (earlyItems) {
                emitter.emitMany(earlyItems);
            }
            this._errorFn = (error) => emitter.reject(error);
            this._emitOneFn = (item) => emitter.emitOne(item);
            this._emitManyFn = (items) => emitter.emitMany(items);
            return this._deferred.p;
        }, onReturn);
        let earlyError;
        let earlyItems;
        this._errorFn = (error) => {
            if (!earlyError) {
                earlyError = error;
            }
        };
        this._emitOneFn = (item) => {
            if (!earlyItems) {
                earlyItems = [];
            }
            earlyItems.push(item);
        };
        this._emitManyFn = (items) => {
            if (!earlyItems) {
                earlyItems = items.slice();
            }
            else {
                items.forEach(item => earlyItems.push(item));
            }
        };
    }
    get asyncIterable() {
        return this._asyncIterable;
    }
    resolve() {
        this._deferred.complete();
    }
    reject(error) {
        this._errorFn(error);
        this._deferred.complete();
    }
    emitOne(item) {
        this._emitOneFn(item);
    }
    emitMany(items) {
        this._emitManyFn(items);
    }
}
export function cancellableIterable(iterableOrIterator, token) {
    const iterator = Symbol.asyncIterator in iterableOrIterator ? iterableOrIterator[Symbol.asyncIterator]() : iterableOrIterator;
    return {
        async next() {
            if (token.isCancellationRequested) {
                return { done: true, value: undefined };
            }
            const result = await raceCancellation(iterator.next(), token);
            return result || { done: true, value: undefined };
        },
        throw: iterator.throw?.bind(iterator),
        return: iterator.return?.bind(iterator),
        [Symbol.asyncIterator]() {
            return this;
        }
    };
}
class ProducerConsumer {
    constructor() {
        this._unsatisfiedConsumers = [];
        this._unconsumedValues = [];
    }
    get hasFinalValue() {
        return !!this._finalValue;
    }
    produce(value) {
        this._ensureNoFinalValue();
        if (this._unsatisfiedConsumers.length > 0) {
            const deferred = this._unsatisfiedConsumers.shift();
            this._resolveOrRejectDeferred(deferred, value);
        }
        else {
            this._unconsumedValues.push(value);
        }
    }
    produceFinal(value) {
        this._ensureNoFinalValue();
        this._finalValue = value;
        for (const deferred of this._unsatisfiedConsumers) {
            this._resolveOrRejectDeferred(deferred, value);
        }
        this._unsatisfiedConsumers.length = 0;
    }
    _ensureNoFinalValue() {
        if (this._finalValue) {
            throw new BugIndicatingError('ProducerConsumer: cannot produce after final value has been set');
        }
    }
    _resolveOrRejectDeferred(deferred, value) {
        if (value.ok) {
            deferred.complete(value.value);
        }
        else {
            deferred.error(value.error);
        }
    }
    consume() {
        if (this._unconsumedValues.length > 0 || this._finalValue) {
            const value = this._unconsumedValues.length > 0 ? this._unconsumedValues.shift() : this._finalValue;
            if (value.ok) {
                return Promise.resolve(value.value);
            }
            else {
                return Promise.reject(value.error);
            }
        }
        else {
            const deferred = new DeferredPromise();
            this._unsatisfiedConsumers.push(deferred);
            return deferred.p;
        }
    }
}
/**
 * Important difference to AsyncIterableObject:
 * If it is iterated two times, the second iterator will not see the values emitted by the first iterator.
 */
export class AsyncIterableProducer {
    constructor(executor, _onReturn) {
        this._onReturn = _onReturn;
        this._producerConsumer = new ProducerConsumer();
        this._iterator = {
            next: () => this._producerConsumer.consume(),
            return: () => {
                this._onReturn?.();
                return Promise.resolve({ done: true, value: undefined });
            },
            throw: async (e) => {
                this._finishError(e);
                return { done: true, value: undefined };
            },
        };
        queueMicrotask(async () => {
            const p = executor({
                emitOne: value => this._producerConsumer.produce({ ok: true, value: { done: false, value: value } }),
                emitMany: values => {
                    for (const value of values) {
                        this._producerConsumer.produce({ ok: true, value: { done: false, value: value } });
                    }
                },
                reject: error => this._finishError(error),
            });
            if (!this._producerConsumer.hasFinalValue) {
                try {
                    await p;
                    this._finishOk();
                }
                catch (error) {
                    this._finishError(error);
                }
            }
        });
    }
    static fromArray(items) {
        return new AsyncIterableProducer((writer) => {
            writer.emitMany(items);
        });
    }
    static fromPromise(promise) {
        return new AsyncIterableProducer(async (emitter) => {
            emitter.emitMany(await promise);
        });
    }
    static fromPromisesResolveOrder(promises) {
        return new AsyncIterableProducer(async (emitter) => {
            await Promise.all(promises.map(async (p) => emitter.emitOne(await p)));
        });
    }
    static merge(iterables) {
        return new AsyncIterableProducer(async (emitter) => {
            await Promise.all(iterables.map(async (iterable) => {
                for await (const item of iterable) {
                    emitter.emitOne(item);
                }
            }));
        });
    }
    static { this.EMPTY = AsyncIterableProducer.fromArray([]); }
    static map(iterable, mapFn) {
        return new AsyncIterableProducer(async (emitter) => {
            for await (const item of iterable) {
                emitter.emitOne(mapFn(item));
            }
        });
    }
    static tee(iterable) {
        let emitter1;
        let emitter2;
        const defer = new DeferredPromise();
        const start = async () => {
            if (!emitter1 || !emitter2) {
                return; // not yet ready
            }
            try {
                for await (const item of iterable) {
                    emitter1.emitOne(item);
                    emitter2.emitOne(item);
                }
            }
            catch (err) {
                emitter1.reject(err);
                emitter2.reject(err);
            }
            finally {
                defer.complete();
            }
        };
        const p1 = new AsyncIterableProducer(async (emitter) => {
            emitter1 = emitter;
            start();
            return defer.p;
        });
        const p2 = new AsyncIterableProducer(async (emitter) => {
            emitter2 = emitter;
            start();
            return defer.p;
        });
        return [p1, p2];
    }
    map(mapFn) {
        return AsyncIterableProducer.map(this, mapFn);
    }
    static coalesce(iterable) {
        return AsyncIterableProducer.filter(iterable, item => !!item);
    }
    coalesce() {
        return AsyncIterableProducer.coalesce(this);
    }
    static filter(iterable, filterFn) {
        return new AsyncIterableProducer(async (emitter) => {
            for await (const item of iterable) {
                if (filterFn(item)) {
                    emitter.emitOne(item);
                }
            }
        });
    }
    filter(filterFn) {
        return AsyncIterableProducer.filter(this, filterFn);
    }
    _finishOk() {
        if (!this._producerConsumer.hasFinalValue) {
            this._producerConsumer.produceFinal({ ok: true, value: { done: true, value: undefined } });
        }
    }
    _finishError(error) {
        if (!this._producerConsumer.hasFinalValue) {
            this._producerConsumer.produceFinal({ ok: false, error: error });
        }
        // Warning: this can cause to dropped errors.
    }
    [Symbol.asyncIterator]() {
        return this._iterator;
    }
}
export class CancelableAsyncIterableProducer extends AsyncIterableProducer {
    constructor(_source, executor) {
        super(executor);
        this._source = _source;
    }
    cancel() {
        this._source.cancel();
    }
}
//#endregion
export const AsyncReaderEndOfStream = Symbol('AsyncReaderEndOfStream');
export class AsyncReader {
    get endOfStream() { return this._buffer.length === 0 && this._atEnd; }
    constructor(_source) {
        this._source = _source;
        this._buffer = [];
        this._atEnd = false;
    }
    async read() {
        if (this._buffer.length === 0 && !this._atEnd) {
            await this._extendBuffer();
        }
        if (this._buffer.length === 0) {
            return AsyncReaderEndOfStream;
        }
        return this._buffer.shift();
    }
    async readWhile(predicate, callback) {
        do {
            const piece = await this.peek();
            if (piece === AsyncReaderEndOfStream) {
                break;
            }
            if (!predicate(piece)) {
                break;
            }
            await this.read(); // consume
            await callback(piece);
        } while (true);
    }
    readBufferedOrThrow() {
        const value = this.peekBufferedOrThrow();
        this._buffer.shift();
        return value;
    }
    async consumeToEnd() {
        while (!this.endOfStream) {
            await this.read();
        }
    }
    async peek() {
        if (this._buffer.length === 0 && !this._atEnd) {
            await this._extendBuffer();
        }
        if (this._buffer.length === 0) {
            return AsyncReaderEndOfStream;
        }
        return this._buffer[0];
    }
    peekBufferedOrThrow() {
        if (this._buffer.length === 0) {
            if (this._atEnd) {
                return AsyncReaderEndOfStream;
            }
            throw new BugIndicatingError('No buffered elements');
        }
        return this._buffer[0];
    }
    async peekTimeout(timeoutMs) {
        if (this._buffer.length === 0 && !this._atEnd) {
            await raceTimeout(this._extendBuffer(), timeoutMs);
        }
        if (this._atEnd) {
            return AsyncReaderEndOfStream;
        }
        if (this._buffer.length === 0) {
            return undefined;
        }
        return this._buffer[0];
    }
    _extendBuffer() {
        if (this._atEnd) {
            return Promise.resolve();
        }
        if (!this._extendBufferPromise) {
            this._extendBufferPromise = (async () => {
                const { value, done } = await this._source.next();
                this._extendBufferPromise = undefined;
                if (done) {
                    this._atEnd = true;
                }
                else {
                    this._buffer.push(value);
                }
            })();
        }
        return this._extendBufferPromise;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vYXN5bmMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQy9FLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUNwRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM1QyxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBZ0MsWUFBWSxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3hJLE9BQU8sRUFBRSxNQUFNLElBQUksYUFBYSxFQUFXLE1BQU0sZ0JBQWdCLENBQUM7QUFFbEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUM1QyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQzlDLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFakMsTUFBTSxVQUFVLFVBQVUsQ0FBSSxHQUFZO0lBQ3pDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsSUFBSSxPQUFRLEdBQTZCLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQztBQUMzRSxDQUFDO0FBTUQ7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBTSxVQUFVLHVCQUF1QixDQUFJLFFBQWtEO0lBQzVGLE1BQU0sTUFBTSxHQUFHLElBQUksdUJBQXVCLEVBQUUsQ0FBQztJQUU3QyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXhDLElBQUksV0FBVyxHQUFHLEtBQUssQ0FBQztJQUV4QixNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBSSxDQUFDLE9B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