/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { diffSets } from './collections.js';
import { onUnexpectedError } from './errors.js';
import { createSingleCallFunction } from './functional.js';
import { combinedDisposable, Disposable, DisposableMap, DisposableStore, toDisposable } from './lifecycle.js';
import { LinkedList } from './linkedList.js';
import { StopWatch } from './stopwatch.js';
// -----------------------------------------------------------------------------------------------------------------------
// Uncomment the next line to print warnings whenever an emitter with listeners is disposed. That is a sign of code smell.
// -----------------------------------------------------------------------------------------------------------------------
const _enableDisposeWithListenerWarning = false;
// -----------------------------------------------------------------------------------------------------------------------
// Uncomment the next line to print warnings whenever a snapshotted event is used repeatedly without cleanup.
// See https://github.com/microsoft/vscode/issues/142851
// -----------------------------------------------------------------------------------------------------------------------
const _enableSnapshotPotentialLeakWarning = false;
export var Event;
(function (Event) {
    Event.None = () => Disposable.None;
    function _addLeakageTraceLogic(options) {
        if (_enableSnapshotPotentialLeakWarning) {
            const { onDidAddListener: origListenerDidAdd } = options;
            const stack = Stacktrace.create();
            let count = 0;
            options.onDidAddListener = () => {
                if (++count === 2) {
                    console.warn('snapshotted emitter LIKELY used public and SHOULD HAVE BEEN created with DisposableStore. snapshotted here');
                    stack.print();
                }
                origListenerDidAdd?.();
            };
        }
    }
    /**
     * Given an event, returns another event which debounces calls and defers the listeners to a later task via a shared
     * `setTimeout`. The event is converted into a signal (`Event<void>`) to avoid additional object creation as a
     * result of merging events and to try prevent race conditions that could arise when using related deferred and
     * non-deferred events.
     *
     * This is useful for deferring non-critical work (eg. general UI updates) to ensure it does not block critical work
     * (eg. latency of keypress to text rendered).
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param disposable A disposable store to add the new EventEmitter to.
     */
    function defer(event, disposable) {
        return debounce(event, () => void 0, 0, undefined, true, undefined, disposable);
    }
    Event.defer = defer;
    /**
     * Given an event, returns another event which only fires once.
     *
     * @param event The event source for the new event.
     */
    function once(event) {
        return (listener, thisArgs = null, disposables) => {
            // we need this, in case the event fires during the listener call
            let didFire = false;
            let result = undefined;
            result = event(e => {
                if (didFire) {
                    return;
                }
                else if (result) {
                    result.dispose();
                }
                else {
                    didFire = true;
                }
                return listener.call(thisArgs, e);
            }, null, disposables);
            if (didFire) {
                result.dispose();
            }
            return result;
        };
    }
    Event.once = once;
    /**
     * Given an event, returns another event which only fires once, and only when the condition is met.
     *
     * @param event The event source for the new event.
     */
    function onceIf(event, condition) {
        return Event.once(Event.filter(event, condition));
    }
    Event.onceIf = onceIf;
    /**
     * Maps an event of one type into an event of another type using a mapping function, similar to how
     * `Array.prototype.map` works.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param map The mapping function.
     * @param disposable A disposable store to add the new EventEmitter to.
     */
    function map(event, map, disposable) {
        return snapshot((listener, thisArgs = null, disposables) => event(i => listener.call(thisArgs, map(i)), null, disposables), disposable);
    }
    Event.map = map;
    /**
     * Wraps an event in another event that performs some function on the event object before firing.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param each The function to perform on the event object.
     * @param disposable A disposable store to add the new EventEmitter to.
     */
    function forEach(event, each, disposable) {
        return snapshot((listener, thisArgs = null, disposables) => event(i => { each(i); listener.call(thisArgs, i); }, null, disposables), disposable);
    }
    Event.forEach = forEach;
    function filter(event, filter, disposable) {
        return snapshot((listener, thisArgs = null, disposables) => event(e => filter(e) && listener.call(thisArgs, e), null, disposables), disposable);
    }
    Event.filter = filter;
    /**
     * Given an event, returns the same event but typed as `Event<void>`.
     */
    function signal(event) {
        return event;
    }
    Event.signal = signal;
    function any(...events) {
        return (listener, thisArgs = null, disposables) => {
            const disposable = combinedDisposable(...events.map(event => event(e => listener.call(thisArgs, e))));
            return addAndReturnDisposable(disposable, disposables);
        };
    }
    Event.any = any;
    /**
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     */
    function reduce(event, merge, initial, disposable) {
        let output = initial;
        return map(event, e => {
            output = merge(output, e);
            return output;
        }, disposable);
    }
    Event.reduce = reduce;
    function snapshot(event, disposable) {
        let listener;
        const options = {
            onWillAddFirstListener() {
                listener = event(emitter.fire, emitter);
            },
            onDidRemoveLastListener() {
                listener?.dispose();
            }
        };
        if (!disposable) {
            _addLeakageTraceLogic(options);
        }
        const emitter = new Emitter(options);
        disposable?.add(emitter);
        return emitter.event;
    }
    /**
     * Adds the IDisposable to the store if it's set, and returns it. Useful to
     * Event function implementation.
     */
    function addAndReturnDisposable(d, store) {
        if (store instanceof Array) {
            store.push(d);
        }
        else if (store) {
            store.add(d);
        }
        return d;
    }
    function debounce(event, merge, delay = 100, leading = false, flushOnListenerRemove = false, leakWarningThreshold, disposable) {
        let subscription;
        let output = undefined;
        let handle = undefined;
        let numDebouncedCalls = 0;
        let doFire;
        const options = {
            leakWarningThreshold,
            onWillAddFirstListener() {
                subscription = event(cur => {
                    numDebouncedCalls++;
                    output = merge(output, cur);
                    if (leading && !handle) {
                        emitter.fire(output);
                        output = undefined;
                    }
                    doFire = () => {
                        const _output = output;
                        output = undefined;
                        handle = undefined;
                        if (!leading || numDebouncedCalls > 1) {
                            emitter.fire(_output);
                        }
                        numDebouncedCalls = 0;
                    };
                    if (typeof delay === 'number') {
                        if (handle) {
                            clearTimeout(handle);
                        }
                        handle = setTimeout(doFire, delay);
                    }
                    else {
                        if (handle === undefined) {
                            handle = null;
                            queueMicrotask(doFire);
                        }
                    }
                });
            },
            onWillRemoveListener() {
                if (flushOnListenerRemove && numDebouncedCalls > 0) {
                    doFire?.();
                }
            },
            onDidRemoveLastListener() {
                doFire = undefined;
                subscription.dispose();
            }
        };
        if (!disposable) {
            _addLeakageTraceLogic(options);
        }
        const emitter = new Emitter(options);
        disposable?.add(emitter);
        return emitter.event;
    }
    Event.debounce = debounce;
    /**
     * Debounces an event, firing after some delay (default=0) with an array of all event original objects.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     */
    function accumulate(event, delay = 0, disposable) {
        return Event.debounce(event, (last, e) => {
            if (!last) {
                return [e];
            }
            last.push(e);
            return last;
        }, delay, undefined, true, undefined, disposable);
    }
    Event.accumulate = accumulate;
    /**
     * Filters an event such that some condition is _not_ met more than once in a row, effectively ensuring duplicate
     * event objects from different sources do not fire the same event object.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param equals The equality condition.
     * @param disposable A disposable store to add the new EventEmitter to.
     *
     * @example
     * ```
     * // Fire only one time when a single window is opened or focused
     * Event.latch(Event.any(onDidOpenWindow, onDidFocusWindow))
     * ```
     */
    function latch(event, equals = (a, b) => a === b, disposable) {
        let firstCall = true;
        let cache;
        return filter(event, value => {
            const shouldEmit = firstCall || !equals(value, cache);
            firstCall = false;
            cache = value;
            return shouldEmit;
        }, disposable);
    }
    Event.latch = latch;
    /**
     * Splits an event whose parameter is a union type into 2 separate events for each type in the union.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @example
     * ```
     * const event = new EventEmitter<number | undefined>().event;
     * const [numberEvent, undefinedEvent] = Event.split(event, isUndefined);
     * ```
     *
     * @param event The event source for the new event.
     * @param isT A function that determines what event is of the first type.
     * @param disposable A disposable store to add the new EventEmitter to.
     */
    function split(event, isT, disposable) {
        return [
            Event.filter(event, isT, disposable),
            Event.filter(event, e => !isT(e), disposable),
        ];
    }
    Event.split = split;
    /**
     * Buffers an event until it has a listener attached.
     *
     * *NOTE* that this function returns an `Event` and it MUST be called with a `DisposableStore` whenever the returned
     * event is accessible to "third parties", e.g the event is a public property. Otherwise a leaked listener on the
     * returned event causes this utility to leak a listener on the original event.
     *
     * @param event The event source for the new event.
     * @param flushAfterTimeout Determines whether to flush the buffer after a timeout immediately or after a
     * `setTimeout` when the first event listener is added.
     * @param _buffer Internal: A source event array used for tests.
     *
     * @example
     * ```
     * // Start accumulating events, when the first listener is attached, flush
     * // the event after a timeout such that multiple listeners attached before
     * // the timeout would receive the event
     * this.onInstallExtension = Event.buffer(service.onInstallExtension, true);
     * ```
     */
    function buffer(event, flushAfterTimeout = false, _buffer = [], disposable) {
        let buffer = _buffer.slice();
        let listener = event(e => {
            if (buffer) {
                buffer.push(e);
            }
            else {
                emitter.fire(e);
            }
        });
        if (disposable) {
            disposable.add(listener);
        }
        const flush = () => {
            buffer?.forEach(e => emitter.fire(e));
            buffer = null;
        };
        const emitter = new Emitter({
            onWillAddFirstListener() {
                if (!listener) {
                    listener = event(e => emitter.fire(e));
                    if (disposable) {
                        disposable.add(listener);
                    }
                }
            },
            onDidAddFirstListener() {
                if (buffer) {
                    if (flushAfterTimeout) {
                        setTimeout(flush);
                    }
                    else {
                        flush();
                    }
                }
            },
            onDidRemoveLastListener() {
                if (listener) {
                    listener.dispose();
                }
                listener = null;
            }
        });
        if (disposable) {
            disposable.add(emitter);
        }
        return emitter.event;
    }
    Event.buffer = buffer;
    /**
     * Wraps the event in an {@link IChainableEvent}, allowing a more functional programming style.
     *
     * @example
     * ```
     * // Normal
     * const onEnterPressNormal = Event.filter(
     *   Event.map(onKeyPress.event, e => new StandardKeyboardEvent(e)),
     *   e.keyCode === KeyCode.Enter
     * ).event;
     *
     * // Using chain
     * const onEnterPressChain = Event.chain(onKeyPress.event, $ => $
     *   .map(e => new StandardKeyboardEvent(e))
     *   .filter(e => e.keyCode === KeyCode.Enter)
     * );
     * ```
     */
    function chain(event, sythensize) {
        const fn = (listener, thisArgs, disposables) => {
            const cs = sythensize(new ChainableSynthesis());
            return event(function (value) {
                const result = cs.evaluate(value);
                if (result !== HaltChainable) {
                    listener.call(thisArgs, result);
                }
            }, undefined, disposables);
        };
        return fn;
    }
    Event.chain = chain;
    const HaltChainable = Symbol('HaltChainable');
    class ChainableSynthesis {
        constructor() {
            this.steps = [];
        }
        map(fn) {
            this.steps.push(fn);
            return this;
        }
        forEach(fn) {
            this.steps.push(v => {
                fn(v);
                return v;
            });
            return this;
        }
        filter(fn) {
            this.steps.push(v => fn(v) ? v : HaltChainable);
            return this;
        }
        reduce(merge, initial) {
            let last = initial;
            this.steps.push(v => {
                last = merge(last, v);
                return last;
            });
            return this;
        }
        latch(equals = (a, b) => a === b) {
            let firstCall = true;
            let cache;
            this.steps.push(value => {
                const shouldEmit = firstCall || !equals(value, cache);
                firstCall = false;
                cache = value;
                return shouldEmit ? value : HaltChainable;
            });
            return this;
        }
        evaluate(value) {
            for (const step of this.steps) {
                value = step(value);
                if (value === HaltChainable) {
                    break;
                }
            }
            return value;
        }
    }
    /**
     * Creates an {@link Event} from a node event emitter.
     */
    function fromNodeEventEmitter(emitter, eventName, map = id => id) {
        const fn = (...args) => result.fire(map(...args));
        const onFirstListenerAdd = () => emitter.on(eventName, fn);
        const onLastListenerRemove = () => emitter.removeListener(eventName, fn);
        const result = new Emitter({ onWillAddFirstListener: onFirstListenerAdd, onDidRemoveLastListener: onLastListenerRemove });
        return result.event;
    }
    Event.fromNodeEventEmitter = fromNodeEventEmitter;
    /**
     * Creates an {@link Event} from a DOM event emitter.
     */
    function fromDOMEventEmitter(emitter, eventName, map = id => id) {
        const fn = (...args) => result.fire(map(...args));
        const onFirstListenerAdd = () => emitter.addEventListener(eventName, fn);
        const onLastListenerRemove = () => emitter.removeEventListener(eventName, fn);
        const result = new Emitter({ onWillAddFirstListener: onFirstListenerAdd, onDidRemoveLastListener: onLastListenerRemove });
        return result.event;
    }
    Event.fromDOMEventEmitter = fromDOMEventEmitter;
    /**
     * Creates a promise out of an event, using the {@link Event.once} helper.
     */
    function toPromise(event, disposables) {
        let cancelRef;
        let listener;
        const promise = new Promise((resolve) => {
            listener = once(event)(resolve);
            addToDisposables(listener, disposables);
            // not resolved, matching the behavior of a normal disposal
            cancelRef = () => {
                disposeAndRemove(listener, disposables);
            };
        });
        promise.cancel = cancelRef;
        if (disposables) {
            promise.finally(() => disposeAndRemove(listener, disposables));
        }
        return promise;
    }
    Event.toPromise = toPromise;
    /**
     * A convenience function for forwarding an event to another emitter which
     * improves readability.
     *
     * This is similar to {@link Relay} but allows instantiating and forwarding
     * on a single line and also allows for multiple source events.
     * @param from The event to forward.
     * @param to The emitter to forward the event to.
     * @example
     * Event.forward(event, emitter);
     * // equivalent to
     * event(e => emitter.fire(e));
     * // equivalent to
     * event(emitter.fire, emitter);
     */
    function forward(from, to) {
        return from(e => to.fire(e));
    }
    Event.forward = forward;
    function runAndSubscribe(event, handler, initial) {
        handler(initial);
        return event(e => handler(e));
    }
    Event.runAndSubscribe = runAndSubscribe;
    class EmitterObserver {
        constructor(_observable, store) {
            this._observable = _observable;
            this._counter = 0;
            this._hasChanged = false;
            const options = {
                onWillAddFirstListener: () => {
                    _observable.addObserver(this);
                    // Communicate to the observable that we received its current value and would like to be notified about future changes.
                    this._observable.reportChanges();
                },
                onDidRemoveLastListener: () => {
                    _observable.removeObserver(this);
                }
            };
            if (!store) {
                _addLeakageTraceLogic(options);
            }
            this.emitter = new Emitter(options);
            if (store) {
                store.add(this.emitter);
            }
        }
        beginUpdate(_observable) {
            // assert(_observable === this.obs);
            this._counter++;
        }
        handlePossibleChange(_observable) {
            // assert(_observable === this.obs);
        }
        handleChange(_observable, _change) {
            // assert(_observable === this.obs);
            this._hasChanged = true;
        }
        endUpdate(_observable) {
            // assert(_observable === this.obs);
            this._counter--;
            if (this._counter === 0) {
                this._observable.reportChanges();
                if (this._hasChanged) {
                    this._hasChanged = false;
                    this.emitter.fire(this._observable.get());
                }
            }
        }
    }
    /**
     * Creates an event emitter that is fired when the observable changes.
     * Each listeners subscribes to the emitter.
     */
    function fromObservable(obs, store) {
        const observer = new EmitterObserver(obs, store);
        return observer.emitter.event;
    }
    Event.fromObservable = fromObservable;
    /**
     * Each listener is attached to the observable directly.
     */
    function fromObservableLight(observable) {
        return (listener, thisArgs, disposables) => {
            let count = 0;
            let didChange = false;
            const observer = {
                beginUpdate() {
                    count++;
                },
                endUpdate() {
                    count--;
                    if (count === 0) {
                        observable.reportChanges();
                        if (didChange) {
                            didChange = false;
                            listener.call(thisArgs);
                        }
                    }
                },
                handlePossibleChange() {
                    // noop
                },
                handleChange() {
                    didChange = true;
                }
            };
            observable.addObserver(observer);
            observable.reportChanges();
            const disposable = {
                dispose() {
                    observable.removeObserver(observer);
                }
            };
            addToDisposables(disposable, disposables);
            return disposable;
        };
    }
    Event.fromObservableLight = fromObservableLight;
})(Event || (Event = {}));
export class EventProfiling {
    static { this.all = new Set(); }
    static { this._idPool = 0; }
    constructor(name) {
        this.listenerCount = 0;
        this.invocationCount = 0;
        this.elapsedOverall = 0;
        this.durations = [];
        this.name = `${name}_${EventProfiling._idPool++}`;
        EventProfiling.all.add(this);
    }
    start(listenerCount) {
        this._stopWatch = new StopWatch();
        this.listenerCount = listenerCount;
    }
    stop() {
        if (this._stopWatch) {
            const elapsed = this._stopWatch.elapsed();
            this.durations.push(elapsed);
            this.elapsedOverall += elapsed;
            this.invocationCount += 1;
            this._stopWatch = undefined;
        }
    }
}
let _globalLeakWarningThreshold = -1;
export function setGlobalLeakWarningThreshold(n) {
    const oldValue = _globalLeakWarningThreshold;
    _globalLeakWarningThreshold = n;
    return {
        dispose() {
            _globalLeakWarningThreshold = oldValue;
        }
    };
}
class LeakageMonitor {
    static { this._idPool = 1; }
    constructor(_errorHandler, threshold, name = (LeakageMonitor._idPool++).toString(16).padStart(3, '0')) {
        this._errorHandler = _errorHandler;
        this.threshold = threshold;
        this.name = name;
        this._warnCountdown = 0;
    }
    dispose() {
        this._stacks?.clear();
    }
    check(stack, listenerCount) {
        const threshold = this.threshold;
        if (threshold <= 0 || listenerCount < threshold) {
            return undefined;
        }
        if (!this._stacks) {
            this._stacks = new Map();
        }
        const count = (this._stacks.get(stack.value) || 0);
        this._stacks.set(stack.value, count + 1);
        this._warnCountdown -= 1;
        if (this._warnCountdown <= 0) {
            // only warn on first exceed and then every time the limit
            // is exceeded by 50% again
            this._warnCountdown = threshold * 0.5;
            const [topStack, topCount] = this.getMostFrequentStack();
            const message = `[${this.name}] potential listener LEAK detected, having ${listenerCount} listeners already. MOST frequent listener (${topCount}):`;
            console.warn(message);
            console.warn(topStack);
            const error = new ListenerLeakError(message, topStack);
            this._errorHandler(error);
        }
        return () => {
            const count = (this._stacks.get(stack.value) || 0);
            this._stacks.set(stack.value, count - 1);
        };
    }
    getMostFrequentStack() {
        if (!this._stacks) {
            return undefined;
        }
        let topStack;
        let topCount = 0;
        for (const [stack, count] of this._stacks) {
            if (!topStack || topCount < count) {
                topStack = [stack, count];
                topCount = count;
            }
        }
        return topStack;
    }
}
class Stacktrace {
    static create() {
        const err = new Error();
        return new Stacktrace(err.stack ?? '');
    }
    constructor(value) {
        this.value = value;
    }
    print() {
        console.warn(this.value.split('\n').slice(2).join('\n'));
    }
}
// error that is logged when going over the configured listener threshold
export class ListenerLeakError extends Error {
    constructor(message, stack) {
        super(message);
        this.name = 'ListenerLeakError';
        this.stack = stack;
    }
}
// SEVERE error that is logged when having gone way over the configured listener
// threshold so that the emitter refuses to accept more listeners
export class ListenerRefusalError extends Error {
    constructor(message, stack) {
        super(message);
        this.name = 'ListenerRefusalError';
        this.stack = stack;
    }
}
let id = 0;
class UniqueContainer {
    constructor(value) {
        this.value = value;
        this.id = id++;
    }
}
const compactionThreshold = 2;
const forEachListener = (listeners, fn) => {
    if (listeners instanceof UniqueContainer) {
        fn(listeners);
    }
    else {
        for (let i = 0; i < listeners.length; i++) {
            const l = listeners[i];
            if (l) {
                fn(l);
            }
        }
    }
};
/**
 * The Emitter can be used to expose an Event to the public
 * to fire it from the insides.
 * Sample:
    class Document {

        private readonly _onDidChange = new Emitter<(value:string)=>any>();

        public onDidChange = this._onDidChange.event;

        // getter-style
        // get onDidChange(): Event<(value:string)=>any> {
        // 	return this._onDidChange.event;
        // }

        private _doIt() {
            //...
            this._onDidChange.fire(value);
        }
    }
 */
export class Emitter {
    constructor(options) {
        this._size = 0;
        this._options = options;
        this._leakageMon = (_globalLeakWarningThreshold > 0 || this._options?.leakWarningThreshold)
            ? new LeakageMonitor(options?.onListenerError ?? onUnexpectedError, this._options?.leakWarningThreshold ?? _globalLeakWarningThreshold) :
            undefined;
        this._perfMon = this._options?._profName ? new EventProfiling(this._options._profName) : undefined;
        this._deliveryQueue = this._options?.deliveryQueue;
    }
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            // It is bad to have listeners at the time of disposing an emitter, it is worst to have listeners keep the emitter
            // alive via the reference that's embedded in their disposables. Therefore we loop over all remaining listeners and
            // unset their subscriptions/disposables. Looping and blaming remaining listeners is done on next tick because the
            // the following programming pattern is very popular:
            //
            // const someModel = this._disposables.add(new ModelObject()); // (1) create and register model
            // this._disposables.add(someModel.onDidChange(() => { ... }); // (2) subscribe and register model-event listener
            // ...later...
            // this._disposables.dispose(); disposes (1) then (2): don't warn after (1) but after the "overall dispose" is done
            if (this._deliveryQueue?.current === this) {
                this._deliveryQueue.reset();
            }
            if (this._listeners) {
                if (_enableDisposeWithListenerWarning) {
                    const listeners = this._listeners;
                    queueMicrotask(() => {
                        forEachListener(listeners, l => l.stack?.print());
                    });
                }
                this._listeners = undefined;
                this._size = 0;
            }
            this._options?.onDidRemoveLastListener?.();
            this._leakageMon?.dispose();
        }
    }
    /**
     * For the public to allow to subscribe
     * to events from this Emitter
     */
    get event() {
        this._event ??= (callback, thisArgs, disposables) => {
            if (this._leakageMon && this._size > this._leakageMon.threshold ** 2) {
                const message = `[${this._leakageMon.name}] REFUSES to accept new listeners because it exceeded its threshold by far (${this._size} vs ${this._leakageMon.threshold})`;
                console.warn(message);
                const tuple = this._leakageMon.getMostFrequentStack() ?? ['UNKNOWN stack', -1];
                const error = new ListenerRefusalError(`${message}. HINT: Stack shows most frequent listener (${tuple[1]}-times)`, tuple[0]);
                const errorHandler = this._options?.onListenerError || onUnexpectedError;
                errorHandler(error);
                return Disposable.None;
            }
            if (this._disposed) {
                // todo: should we warn if a listener is added to a disposed emitter? This happens often
                return Disposable.None;
            }
            if (thisArgs) {
                callback = callback.bind(thisArgs);
            }
            const contained = new UniqueContainer(callback);
            let removeMonitor;
            let stack;
            if (this._leakageMon && this._size >= Math.ceil(this._leakageMon.threshold * 0.2)) {
                // check and record this emitter for potential leakage
                contained.stack = Stacktrace.create();
                removeMonitor = this._leakageMon.check(contained.stack, this._size + 1);
            }
            if (_enableDisposeWithListenerWarning) {
                contained.stack = stack ?? Stacktrace.create();
            }
            if (!this._listeners) {
                this._options?.onWillAddFirstListener?.(this);
                this._listeners = contained;
                this._options?.onDidAddFirstListener?.(this);
            }
            else if (this._listeners instanceof UniqueContainer) {
                this._deliveryQueue ??= new EventDeliveryQueuePrivate();
                this._listeners = [this._listeners, contained];
            }
            else {
                this._listeners.push(contained);
            }
            this._options?.onDidAddListener?.(this);
            this._size++;
            const result = toDisposable(() => {
                removeMonitor?.();
                this._removeListener(contained);
            });
            addToDisposables(result, disposables);
            return result;
        };
        return this._event;
    }
    _removeListener(listener) {
        this._options?.onWillRemoveListener?.(this);
        if (!this._listeners) {
            return; // expected if a listener gets disposed
        }
        if (this._size === 1) {
            this._listeners = undefined;
            this._options?.onDidRemoveLastListener?.(this);
            this._size = 0;
            return;
        }
        // size > 1 which requires that listeners be a list:
        const listeners = this._listeners;
        const index = listeners.indexOf(listener);
        if (index === -1) {
            console.log('disposed?', this._disposed);
            console.log('size?', this._size);
            console.log('arr?', JSON.stringify(this._listeners));
            throw new Error('Attempted to dispose unknown listener');
        }
        this._size--;
        listeners[index] = undefined;
        const adjustDeliveryQueue = this._deliveryQueue.current === this;
        if (this._size * compactionThreshold <= listeners.length) {
            let n = 0;
            for (let i = 0; i < listeners.length; i++) {
                if (listeners[i]) {
                    listeners[n++] = listeners[i];
                }
                else if (adjustDeliveryQueue && n < this._deliveryQueue.end) {
                    this._deliveryQueue.end--;
                    if (n < this._deliveryQueue.i) {
                        this._deliveryQueue.i--;
                    }
                }
            }
            listeners.length = n;
        }
    }
    _deliver(listener, value) {
        if (!listener) {
            return;
        }
        const errorHandler = this._options?.onListenerError || onUnexpectedError;
        if (!errorHandler) {
            listener.value(value);
            return;
        }
        try {
            listener.value(value);
        }
        catch (e) {
            errorHandler(e);
        }
    }
    /** Delivers items in the queue. Assumes the queue is ready to go. */
    _deliverQueue(dq) {
        const listeners = dq.current._listeners;
        while (dq.i < dq.end) {
            // important: dq.i is incremented before calling deliver() because it might reenter deliverQueue()
            this._deliver(listeners[dq.i++], dq.value);
        }
        dq.reset();
    }
    /**
     * To be kept private to fire an event to
     * subscribers
     */
    fire(event) {
        if (this._deliveryQueue?.current) {
            this._deliverQueue(this._deliveryQueue);
            this._perfMon?.stop(); // last fire() will have starting perfmon, stop it before starting the next dispatch
        }
        this._perfMon?.start(this._size);
        if (!this._listeners) {
            // no-op
        }
        else if (this._listeners instanceof UniqueContainer) {
            this._deliver(this._listeners, event);
        }
        else {
            const dq = this._deliveryQueue;
            dq.enqueue(this, event, this._listeners.length);
            this._deliverQueue(dq);
        }
        this._perfMon?.stop();
    }
    hasListeners() {
        return this._size > 0;
    }
}
export const createEventDeliveryQueue = () => new EventDeliveryQueuePrivate();
class EventDeliveryQueuePrivate {
    constructor() {
        /**
         * Index in current's listener list.
         */
        this.i = -1;
        /**
         * The last index in the listener's list to deliver.
         */
        this.end = 0;
    }
    enqueue(emitter, value, end) {
        this.i = 0;
        this.end = end;
        this.current = emitter;
        this.value = value;
    }
    reset() {
        this.i = this.end; // force any current emission loop to stop, mainly for during dispose
        this.current = undefined;
        this.value = undefined;
    }
}
export class AsyncEmitter extends Emitter {
    async fireAsync(data, token, promiseJoin) {
        if (!this._listeners) {
            return;
        }
        if (!this._asyncDeliveryQueue) {
            this._asyncDeliveryQueue = new LinkedList();
        }
        forEachListener(this._listeners, listener => this._asyncDeliveryQueue.push([listener.value, data]));
        while (this._asyncDeliveryQueue.size > 0 && !token.isCancellationRequested) {
            const [listener, data] = this._asyncDeliveryQueue.shift();
            const thenables = [];
            // eslint-disable-next-line local/code-no-dangerous-type-assertions
            const event = {
                ...data,
                token,
                waitUntil: (p) => {
                    if (Object.isFrozen(thenables)) {
                        throw new Error('waitUntil can NOT be called asynchronous');
                    }
                    if (promiseJoin) {
                        p = promiseJoin(p, listener);
                    }
                    thenables.push(p);
                }
            };
            try {
                listener(event);
            }
            catch (e) {
                onUnexpectedError(e);
                continue;
            }
            // freeze thenables-collection to enforce sync-calls to
            // wait until and then wait for all thenables to resolve
            Object.freeze(thenables);
            await Promise.allSettled(thenables).then(values => {
                for (const value of values) {
                    if (value.status === 'rejected') {
                        onUnexpectedError(value.reason);
                    }
                }
            });
        }
    }
}
export class PauseableEmitter extends Emitter {
    get isPaused() {
        return this._isPaused !== 0;
    }
    constructor(options) {
        super(options);
        this._isPaused = 0;
        this._eventQueue = new LinkedList();
        this._mergeFn = options?.merge;
    }
    pause() {
        this._isPaused++;
    }
    resume() {
        if (this._isPaused !== 0 && --this._isPaused === 0) {
            if (this._mergeFn) {
                // use the merge function to create a single composite
                // event. make a copy in case firing pauses this emitter
                if (this._eventQueue.size > 0) {
                    const events = Array.from(this._eventQueue);
                    this._eventQueue.clear();
                    super.fire(this._mergeFn(events));
                }
            }
            else {
                // no merging, fire each event individually and test
                // that this emitter isn't paused halfway through
                while (!this._isPaused && this._eventQueue.size !== 0) {
                    super.fire(this._eventQueue.shift());
                }
            }
        }
    }
    fire(event) {
        if (this._size) {
            if (this._isPaused !== 0) {
                this._eventQueue.push(event);
            }
            else {
                super.fire(event);
            }
        }
    }
}
export class DebounceEmitter extends PauseableEmitter {
    constructor(options) {
        super(options);
        this._delay = options.delay ?? 100;
    }
    fire(event) {
        if (!this._handle) {
            this.pause();
            this._handle = setTimeout(() => {
                this._handle = undefined;
                this.resume();
            }, this._delay);
        }
        super.fire(event);
    }
}
/**
 * An emitter which queue all events and then process them at the
 * end of the event loop.
 */
export class MicrotaskEmitter extends Emitter {
    constructor(options) {
        super(options);
        this._queuedEvents = [];
        this._mergeFn = options?.merge;
    }
    fire(event) {
        if (!this.hasListeners()) {
            return;
        }
        this._queuedEvents.push(event);
        if (this._queuedEvents.length === 1) {
            queueMicrotask(() => {
                if (this._mergeFn) {
                    super.fire(this._mergeFn(this._queuedEvents));
                }
                else {
                    this._queuedEvents.forEach(e => super.fire(e));
                }
                this._queuedEvents = [];
            });
        }
    }
}
/**
 * An event emitter that multiplexes many events into a single event.
 *
 * @example Listen to the `onData` event of all `Thing`s, dynamically adding and removing `Thing`s
 * to the multiplexer as needed.
 *
 * ```typescript
 * const anythingDataMultiplexer = new EventMultiplexer<{ data: string }>();
 *
 * const thingListeners = DisposableMap<Thing, IDisposable>();
 *
 * thingService.onDidAddThing(thing => {
 *   thingListeners.set(thing, anythingDataMultiplexer.add(thing.onData);
 * });
 * thingService.onDidRemoveThing(thing => {
 *   thingListeners.deleteAndDispose(thing);
 * });
 *
 * anythingDataMultiplexer.event(e => {
 *   console.log('Something fired data ' + e.data)
 * });
 * ```
 */
export class EventMultiplexer {
    constructor() {
        this.hasListeners = false;
        this.events = [];
        this.emitter = new Emitter({
            onWillAddFirstListener: () => this.onFirstListenerAdd(),
            onDidRemoveLastListener: () => this.onLastListenerRemove()
        });
    }
    get event() {
        return this.emitter.event;
    }
    add(event) {
        const e = { event: event, listener: null };
        this.events.push(e);
        if (this.hasListeners) {
            this.hook(e);
        }
        const dispose = () => {
            if (this.hasListeners) {
                this.unhook(e);
            }
            const idx = this.events.indexOf(e);
            this.events.splice(idx, 1);
        };
        return toDisposable(createSingleCallFunction(dispose));
    }
    onFirstListenerAdd() {
        this.hasListeners = true;
        this.events.forEach(e => this.hook(e));
    }
    onLastListenerRemove() {
        this.hasListeners = false;
        this.events.forEach(e => this.unhook(e));
    }
    hook(e) {
        e.listener = e.event(r => this.emitter.fire(r));
    }
    unhook(e) {
        e.listener?.dispose();
        e.listener = null;
    }
    dispose() {
        this.emitter.dispose();
        for (const e of this.events) {
            e.listener?.dispose();
        }
        this.events = [];
    }
}
export class DynamicListEventMultiplexer {
    constructor(items, onAddItem, onRemoveItem, getEvent) {
        this._store = new DisposableStore();
        const multiplexer = this._store.add(new EventMultiplexer());
        const itemListeners = this._store.add(new DisposableMap());
        function addItem(instance) {
            itemListeners.set(instance, multiplexer.add(getEvent(instance)));
        }
        // Existing items
        for (const instance of items) {
            addItem(instance);
        }
        // Added items
        this._store.add(onAddItem(instance => {
            addItem(instance);
        }));
        // Removed items
        this._store.add(onRemoveItem(instance => {
            itemListeners.deleteAndDispose(instance);
        }));
        this.event = multiplexer.event;
    }
    dispose() {
        this._store.dispose();
    }
}
/**
 * The EventBufferer is useful in situations in which you want
 * to delay firing your events during some code.
 * You can wrap that code and be sure that the event will not
 * be fired during that wrap.
 *
 * ```
 * const emitter: Emitter;
 * const delayer = new EventDelayer();
 * const delayedEvent = delayer.wrapEvent(emitter.event);
 *
 * delayedEvent(console.log);
 *
 * delayer.bufferEvents(() => {
 *   emitter.fire(); // event will not be fired yet
 * });
 *
 * // event will only be fired at this point
 * ```
 */
export class EventBufferer {
    constructor() {
        this.data = [];
    }
    wrapEvent(event, reduce, initial) {
        return (listener, thisArgs, disposables) => {
            return event(i => {
                const data = this.data[this.data.length - 1];
                // Non-reduce scenario
                if (!reduce) {
                    // Buffering case
                    if (data) {
                        data.buffers.push(() => listener.call(thisArgs, i));
                    }
                    else {
                        // Not buffering case
                        listener.call(thisArgs, i);
                    }
                    return;
                }
                // Reduce scenario
                const reduceData = data;
                // Not buffering case
                if (!reduceData) {
                    // TODO: Is there a way to cache this reduce call for all listeners?
                    listener.call(thisArgs, reduce(initial, i));
                    return;
                }
                // Buffering case
                reduceData.items ??= [];
                reduceData.items.push(i);
                if (reduceData.buffers.length === 0) {
                    // Include a single buffered function that will reduce all events when we're done buffering events
                    data.buffers.push(() => {
                        // cache the reduced result so that the value can be shared across all listeners
                        reduceData.reducedResult ??= initial
                            ? reduceData.items.reduce(reduce, initial)
                            : reduceData.items.reduce(reduce);
                        listener.call(thisArgs, reduceData.reducedResult);
                    });
                }
            }, undefined, disposables);
        };
    }
    bufferEvents(fn) {
        const data = { buffers: new Array() };
        this.data.push(data);
        const r = fn();
        this.data.pop();
        data.buffers.forEach(flush => flush());
        return r;
    }
}
/**
 * A Relay is an event forwarder which functions as a replugabble event pipe.
 * Once created, you can connect an input event to it and it will simply forward
 * events from that input event through its own `event` property. The `input`
 * can be changed at any point in time.
 */
export class Relay {
    constructor() {
        this.listening = false;
        this.inputEvent = Event.None;
        this.inputEventListener = Disposable.None;
        this.emitter = new Emitter({
            onDidAddFirstListener: () => {
                this.listening = true;
                this.inputEventListener = this.inputEvent(this.emitter.fire, this.emitter);
            },
            onDidRemoveLastListener: () => {
                this.listening = false;
                this.inputEventListener.dispose();
            }
        });
        this.event = this.emitter.event;
    }
    set input(event) {
        this.inputEvent = event;
        if (this.listening) {
            this.inputEventListener.dispose();
            this.inputEventListener = event(this.emitter.fire, this.emitter);
        }
    }
    dispose() {
        this.inputEventListener.dispose();
        this.emitter.dispose();
    }
}
export class ValueWithChangeEvent {
    static const(value) {
        return new ConstValueWithChangeEvent(value);
    }
    constructor(_value) {
        this._value = _value;
        this._onDidChange = new Emitter();
        this.onDidChange = this._onDidChange.event;
    }
    get value() {
        return this._value;
    }
    set value(value) {
        if (value !== this._value) {
            this._value = value;
            this._onDidChange.fire(undefined);
        }
    }
}
class ConstValueWithChangeEvent {
    constructor(value) {
        this.value = value;
        this.onDidChange = Event.None;
    }
}
/**
 * @param handleItem Is called for each item in the set (but only the first time the item is seen in the set).
 * 	The returned disposable is disposed if the item is no longer in the set.
 */
export function trackSetChanges(getData, onDidChangeData, handleItem) {
    const map = new DisposableMap();
    let oldData = new Set(getData());
    for (const d of oldData) {
        map.set(d, handleItem(d));
    }
    const store = new DisposableStore();
    store.add(onDidChangeData(() => {
        const newData = getData();
        const diff = diffSets(oldData, newData);
        for (const r of diff.removed) {
            map.deleteAndDispose(r);
        }
        for (const a of diff.added) {
            map.set(a, handleItem(a));
        }
        oldData = new Set(newData);
    }));
    store.add(map);
    return store;
}
function addToDisposables(result, disposables) {
    if (disposables instanceof DisposableStore) {
        disposables.add(result);
    }
    else if (Array.isArray(disposables)) {
        disposables.push(result);
    }
}
function disposeAndRemove(result, disposables) {
    if (disposables instanceof DisposableStore) {
        disposables.delete(result);
    }
    else if (Array.isArray(disposables)) {
        const index = disposables.indexOf(result);
        if (index !== -1) {
            disposables.splice(index, 1);
        }
    }
    result.dispose();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vZXZlbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQzVDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUNoRCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDM0gsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRTdDLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUkzQywwSEFBMEg7QUFDMUgsMEhBQTBIO0FBQzFILDBIQUEwSDtBQUMxSCxNQUFNLGlDQUFpQyxHQUFHLEtBQUssQ0FFN0M7QUFHRiwwSEFBMEg7QUFDMUgsNkdBQTZHO0FBQzdHLHdEQUF3RDtBQUN4RCwwSEFBMEg7QUFDMUgsTUFBTSxtQ0FBbUMsR0FBRyxLQUFLLENBRS9DO0FBU0YsTUFBTSxLQUFXLEtBQUssQ0FrdEJyQjtBQWx0QkQsV0FBaUIsS0FBSztJQUNSLFVBQUksR0FBZSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO0lBRXRELFNBQVMscUJBQXFCLENBQUMsT0FBdUI7UUFDckQsSUFBSSxtQ0FBbUMsRUFBRSxDQUFDO1lBQ3pDLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxrQkFBa0IsRUFBRSxHQUFHLE9BQU8sQ0FBQztZQUN6RCxNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO1lB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