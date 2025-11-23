/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { compareBy, numberComparator, tieBreakComparators } from '../../common/arrays.js';
import { Emitter, Event } from '../../common/event.js';
import { Disposable } from '../../common/lifecycle.js';
import { setTimeout0, setTimeout0IsFaster } from '../../common/platform.js';
const scheduledTaskComparator = tieBreakComparators(compareBy(i => i.time, numberComparator), compareBy(i => i.id, numberComparator));
export class TimeTravelScheduler {
    constructor(startTimeMs) {
        this.taskCounter = 0;
        this._nowMs = 0;
        this.queue = new SimplePriorityQueue([], scheduledTaskComparator);
        this.taskScheduledEmitter = new Emitter();
        this.onTaskScheduled = this.taskScheduledEmitter.event;
        this._nowMs = startTimeMs;
    }
    schedule(task) {
        if (task.time < this._nowMs) {
            throw new Error(`Scheduled time (${task.time}) must be equal to or greater than the current time (${this._nowMs}).`);
        }
        const extendedTask = { ...task, id: this.taskCounter++ };
        this.queue.add(extendedTask);
        this.taskScheduledEmitter.fire({ task });
        return { dispose: () => this.queue.remove(extendedTask) };
    }
    get now() {
        return this._nowMs;
    }
    get hasScheduledTasks() {
        return this.queue.length > 0;
    }
    getScheduledTasks() {
        return this.queue.toSortedArray();
    }
    runNext() {
        const task = this.queue.removeMin();
        if (task) {
            this._nowMs = task.time;
            task.run();
        }
        return task;
    }
    installGlobally() {
        return overwriteGlobals(this);
    }
}
export class AsyncSchedulerProcessor extends Disposable {
    get history() { return this._history; }
    constructor(scheduler, options) {
        super();
        this.scheduler = scheduler;
        this.isProcessing = false;
        this._history = new Array();
        this.queueEmptyEmitter = new Emitter();
        this.onTaskQueueEmpty = this.queueEmptyEmitter.event;
        this.maxTaskCount = options && options.maxTaskCount ? options.maxTaskCount : 100;
        this.useSetImmediate = options && options.useSetImmediate ? options.useSetImmediate : false;
        this._register(scheduler.onTaskScheduled(() => {
            if (this.isProcessing) {
                return;
            }
            else {
                this.isProcessing = true;
                this.schedule();
            }
        }));
    }
    schedule() {
        // This allows promises created by a previous task to settle and schedule tasks before the next task is run.
        // Tasks scheduled in those promises might have to run before the current next task.
        Promise.resolve().then(() => {
            if (this.useSetImmediate) {
                originalGlobalValues.setImmediate(() => this.process());
            }
            else if (setTimeout0IsFaster) {
                setTimeout0(() => this.process());
            }
            else {
                originalGlobalValues.setTimeout(() => this.process());
            }
        });
    }
    process() {
        const executedTask = this.scheduler.runNext();
        if (executedTask) {
            this._history.push(executedTask);
            if (this.history.length >= this.maxTaskCount && this.scheduler.hasScheduledTasks) {
                const lastTasks = this._history.slice(Math.max(0, this.history.length - 10)).map(h => `${h.source.toString()}: ${h.source.stackTrace}`);
                const e = new Error(`Queue did not get empty after processing ${this.history.length} items. These are the last ${lastTasks.length} scheduled tasks:\n${lastTasks.join('\n\n\n')}`);
                this.lastError = e;
                throw e;
            }
        }
        if (this.scheduler.hasScheduledTasks) {
            this.schedule();
        }
        else {
            this.isProcessing = false;
            this.queueEmptyEmitter.fire();
        }
    }
    waitForEmptyQueue() {
        if (this.lastError) {
            const error = this.lastError;
            this.lastError = undefined;
            throw error;
        }
        if (!this.isProcessing) {
            return Promise.resolve();
        }
        else {
            return Event.toPromise(this.onTaskQueueEmpty).then(() => {
                if (this.lastError) {
                    throw this.lastError;
                }
            });
        }
    }
}
export async function runWithFakedTimers(options, fn) {
    const useFakeTimers = options.useFakeTimers === undefined ? true : options.useFakeTimers;
    if (!useFakeTimers) {
        return fn();
    }
    const scheduler = new TimeTravelScheduler(options.startTime ?? 0);
    const schedulerProcessor = new AsyncSchedulerProcessor(scheduler, { useSetImmediate: options.useSetImmediate, maxTaskCount: options.maxTaskCount });
    const globalInstallDisposable = scheduler.installGlobally();
    let didThrow = true;
    let result;
    try {
        result = await fn();
        didThrow = false;
    }
    finally {
        globalInstallDisposable.dispose();
        try {
            if (!didThrow) {
                // We process the remaining scheduled tasks.
                // The global override is no longer active, so during this, no more tasks will be scheduled.
                await schedulerProcessor.waitForEmptyQueue();
            }
        }
        finally {
            schedulerProcessor.dispose();
        }
    }
    return result;
}
export const originalGlobalValues = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    setImmediate: globalThis.setImmediate?.bind(globalThis),
    clearImmediate: globalThis.clearImmediate?.bind(globalThis),
    requestAnimationFrame: globalThis.requestAnimationFrame?.bind(globalThis),
    cancelAnimationFrame: globalThis.cancelAnimationFrame?.bind(globalThis),
    Date: globalThis.Date,
};
function setTimeout(scheduler, handler, timeout = 0) {
    if (typeof handler === 'string') {
        throw new Error('String handler args should not be used and are not supported');
    }
    return scheduler.schedule({
        time: scheduler.now + timeout,
        run: () => {
            handler();
        },
        source: {
            toString() { return 'setTimeout'; },
            stackTrace: new Error().stack,
        }
    });
}
function setInterval(scheduler, handler, interval) {
    if (typeof handler === 'string') {
        throw new Error('String handler args should not be used and are not supported');
    }
    const validatedHandler = handler;
    let iterCount = 0;
    const stackTrace = new Error().stack;
    let disposed = false;
    let lastDisposable;
    function schedule() {
        iterCount++;
        const curIter = iterCount;
        lastDisposable = scheduler.schedule({
            time: scheduler.now + interval,
            run() {
                if (!disposed) {
                    schedule();
                    validatedHandler();
                }
            },
            source: {
                toString() { return `setInterval (iteration ${curIter})`; },
                stackTrace,
            }
        });
    }
    schedule();
    return {
        dispose: () => {
            if (disposed) {
                return;
            }
            disposed = true;
            lastDisposable.dispose();
        }
    };
}
function overwriteGlobals(scheduler) {
    // eslint-disable-next-line local/code-no-any-casts
    globalThis.setTimeout = ((handler, timeout) => setTimeout(scheduler, handler, timeout));
    globalThis.clearTimeout = (timeoutId) => {
        if (typeof timeoutId === 'object' && timeoutId && 'dispose' in timeoutId) {
            timeoutId.dispose();
        }
        else {
            originalGlobalValues.clearTimeout(timeoutId);
        }
    };
    // eslint-disable-next-line local/code-no-any-casts
    globalThis.setInterval = ((handler, timeout) => setInterval(scheduler, handler, timeout));
    globalThis.clearInterval = (timeoutId) => {
        if (typeof timeoutId === 'object' && timeoutId && 'dispose' in timeoutId) {
            timeoutId.dispose();
        }
        else {
            originalGlobalValues.clearInterval(timeoutId);
        }
    };
    globalThis.Date = createDateClass(scheduler);
    return {
        dispose: () => {
            Object.assign(globalThis, originalGlobalValues);
        }
    };
}
function createDateClass(scheduler) {
    const OriginalDate = originalGlobalValues.Date;
    function SchedulerDate(...args) {
        // the Date constructor called as a function, ref Ecma-262 Edition 5.1, section 15.9.2.
        // This remains so in the 10th edition of 2019 as well.
        if (!(this instanceof SchedulerDate)) {
            return new OriginalDate(scheduler.now).toString();
        }
        // if Date is called as a constructor with 'new' keyword
        if (args.length === 0) {
            return new OriginalDate(scheduler.now);
        }
        // eslint-disable-next-line local/code-no-any-casts
        return new OriginalDate(...args);
    }
    for (const prop in OriginalDate) {
        if (OriginalDate.hasOwnProperty(prop)) {
            // eslint-disable-next-line local/code-no-any-casts
            SchedulerDate[prop] = OriginalDate[prop];
        }
    }
    SchedulerDate.now = function now() {
        return scheduler.now;
    };
    SchedulerDate.toString = function toString() {
        return OriginalDate.toString();
    };
    SchedulerDate.prototype = OriginalDate.prototype;
    SchedulerDate.parse = OriginalDate.parse;
    SchedulerDate.UTC = OriginalDate.UTC;
    SchedulerDate.prototype.toUTCString = OriginalDate.prototype.toUTCString;
    // eslint-disable-next-line local/code-no-any-casts
    return SchedulerDate;
}
class SimplePriorityQueue {
    constructor(items, compare) {
        this.compare = compare;
        this.isSorted = false;
        this.items = items;
    }
    get length() {
        return this.items.length;
    }
    add(value) {
        this.items.push(value);
        this.isSorted = false;
    }
    remove(value) {
        const idx = this.items.indexOf(value);
        if (idx !== -1) {
            this.items.splice(idx, 1);
            this.isSorted = false;
        }
    }
    removeMin() {
        this.ensureSorted();
        return this.items.shift();
    }
    getMin() {
        this.ensureSorted();
        return this.items[0];
    }
    toSortedArray() {
        this.ensureSorted();
        return [...this.items];
    }
    ensureSorted() {
        if (!this.isSorted) {
            this.items.sort(this.compare);
            this.isSorted = true;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZVRyYXZlbFNjaGVkdWxlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzFGLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDdkQsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLDJCQUEyQixDQUFDO0FBQ3BFLE9BQU8sRUFBRSxXQUFXLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQXlCNUUsTUFBTSx1QkFBdUIsR0FBRyxtQkFBbUIsQ0FDbEQsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsQ0FBQyxFQUN4QyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLGdCQUFnQixDQUFDLENBQ3RDLENBQUM7QUFFRixNQUFNLE9BQU8sbUJBQW1CO0lBUS9CLFlBQVksV0FBbUI7UUFQdkIsZ0JBQVcsR0FBRyxDQUFDLENBQUM7UUFDaEIsV0FBTSxHQUFlLENBQUMsQ0FBQztRQUNkLFVBQUssR0FBeUMsSUFBSSxtQkFBbUIsQ0FBd0IsRUFBRSxFQUFFLHVCQUF1QixDQUFDLENBQUM7UUFFMUgseUJBQW9CLEdBQUcsSUFBSSxPQUFPLEVBQTJCLENBQUM7UUFDL0Qsb0JBQWUsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDO1FBR2pFLElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDO0lBQzNCLENBQUM7SUFFRCxRQUFRLENBQUMsSUFBbUI7UUFDM0IsSUFB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