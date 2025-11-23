/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
function createDecorator(mapFn) {
    return (_target, key, descriptor) => {
        let fnKey = null;
        let fn = null;
        if (typeof descriptor.value === 'function') {
            fnKey = 'value';
            fn = descriptor.value;
        }
        else if (typeof descriptor.get === 'function') {
            fnKey = 'get';
            fn = descriptor.get;
        }
        if (!fn || typeof key === 'symbol') {
            throw new Error('not supported');
        }
        descriptor[fnKey] = mapFn(fn, key);
    };
}
export function memoize(_target, key, descriptor) {
    let fnKey = null;
    let fn = null;
    if (typeof descriptor.value === 'function') {
        fnKey = 'value';
        fn = descriptor.value;
        if (fn.length !== 0) {
            console.warn('Memoize should only be used in functions with zero parameters');
        }
    }
    else if (typeof descriptor.get === 'function') {
        fnKey = 'get';
        fn = descriptor.get;
    }
    if (!fn) {
        throw new Error('not supported');
    }
    const memoizeKey = `$memoize$${key}`;
    descriptor[fnKey] = function (...args) {
        if (!this.hasOwnProperty(memoizeKey)) {
            Object.defineProperty(this, memoizeKey, {
                configurable: false,
                enumerable: false,
                writable: false,
                value: fn.apply(this, args)
            });
        }
        // eslint-disable-next-line local/code-no-any-casts
        return this[memoizeKey];
    };
}
export function debounce(delay, reducer, initialValueProvider) {
    return createDecorator((fn, key) => {
        const timerKey = `$debounce$${key}`;
        const resultKey = `$debounce$result$${key}`;
        return function (...args) {
            if (!this[resultKey]) {
                this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
            }
            clearTimeout(this[timerKey]);
            if (reducer) {
                this[resultKey] = reducer(this[resultKey], ...args);
                args = [this[resultKey]];
            }
            this[timerKey] = setTimeout(() => {
                fn.apply(this, args);
                this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
            }, delay);
        };
    });
}
export function throttle(delay, reducer, initialValueProvider) {
    return createDecorator((fn, key) => {
        const timerKey = `$throttle$timer$${key}`;
        const resultKey = `$throttle$result$${key}`;
        const lastRunKey = `$throttle$lastRun$${key}`;
        const pendingKey = `$throttle$pending$${key}`;
        return function (...args) {
            if (!this[resultKey]) {
                this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
            }
            if (this[lastRunKey] === null || this[lastRunKey] === undefined) {
                this[lastRunKey] = -Number.MAX_VALUE;
            }
            if (reducer) {
                this[resultKey] = reducer(this[resultKey], ...args);
            }
            if (this[pendingKey]) {
                return;
            }
            const nextTime = this[lastRunKey] + delay;
            if (nextTime <= Date.now()) {
                this[lastRunKey] = Date.now();
                fn.apply(this, [this[resultKey]]);
                this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
            }
            else {
                this[pendingKey] = true;
                this[timerKey] = setTimeout(() => {
                    this[pendingKey] = false;
                    this[lastRunKey] = Date.now();
                    fn.apply(this, [this[resultKey]]);
                    this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
                }, nextTime - Date.now());
            }
        };
    });
}
export { cancelPreviousCalls } from './decorators/cancelPreviousCalls.js';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLFNBQVMsZUFBZSxDQUFDLEtBQThDO0lBQ3RFLE9BQU8sQ0FBQyxPQUFlLEVBQUUsR0FBb0IsRUFBRSxVQUF3QyxFQUFFLEVBQUU7UUFDMUYsSUFBSSxLQUFLLEdBQTJCLElBQUksQ0FBQztRQUN6QyxJQUFJLEVBQUUsR0FBb0IsSUFBSSxDQUFDO1FBRS9CLElBQUksT0FBTyxVQUFVLENBQUMsS0FBSyxLQUFLLFVBQVUsRUFBRSxDQUFDO1lBQzVDLEtBQUssR0FBRyxPQUFPLENBQUM7WUFDaEIsRUFBRSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUM7UUFDdkIsQ0FBQzthQUFNLElBQUksT0FBTyxVQUFVLENBQUMsR0FBRyxLQUFLLFVBQVUsRUFBRSxDQUFDO1lBQ2pELEtBQUssR0FBRyxLQUFLLENBQUM7WUFDZCxFQUFFLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQztRQUNyQixDQUFDO1FBRUQsSUFBSSxDQUFDLEVBQUUsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFFRCxVQUFVLENBQUMsS0FBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNyQyxDQUFDLENBQUM7QUFDSCxDQUFDO0FBRUQsTUFBTSxVQUFVLE9BQU8sQ0FBQyxPQUFlLEVBQUUsR0FBVyxFQUFFLFVBQThCO0lBQ25GLElBQUksS0FBSyxHQUEyQixJQUFJLENBQUM7SUFDekMsSUFBSSxFQUFFLEdBQW9CLElBQUksQ0FBQztJQUUvQixJQUFJLE9BQU8sVUFBVSxDQUFDLEtBQUssS0FB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