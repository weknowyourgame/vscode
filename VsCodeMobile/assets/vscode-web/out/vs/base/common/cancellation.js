/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter, Event } from './event.js';
import { DisposableStore } from './lifecycle.js';
const shortcutEvent = Object.freeze(function (callback, context) {
    const handle = setTimeout(callback.bind(context), 0);
    return { dispose() { clearTimeout(handle); } };
});
export var CancellationToken;
(function (CancellationToken) {
    function isCancellationToken(thing) {
        if (thing === CancellationToken.None || thing === CancellationToken.Cancelled) {
            return true;
        }
        if (thing instanceof MutableToken) {
            return true;
        }
        if (!thing || typeof thing !== 'object') {
            return false;
        }
        return typeof thing.isCancellationRequested === 'boolean'
            && typeof thing.onCancellationRequested === 'function';
    }
    CancellationToken.isCancellationToken = isCancellationToken;
    CancellationToken.None = Object.freeze({
        isCancellationRequested: false,
        onCancellationRequested: Event.None
    });
    CancellationToken.Cancelled = Object.freeze({
        isCancellationRequested: true,
        onCancellationRequested: shortcutEvent
    });
})(CancellationToken || (CancellationToken = {}));
class MutableToken {
    constructor() {
        this._isCancelled = false;
        this._emitter = null;
    }
    cancel() {
        if (!this._isCancelled) {
            this._isCancelled = true;
            if (this._emitter) {
                this._emitter.fire(undefined);
                this.dispose();
            }
        }
    }
    get isCancellationRequested() {
        return this._isCancelled;
    }
    get onCancellationRequested() {
        if (this._isCancelled) {
            return shortcutEvent;
        }
        if (!this._emitter) {
            this._emitter = new Emitter();
        }
        return this._emitter.event;
    }
    dispose() {
        if (this._emitter) {
            this._emitter.dispose();
            this._emitter = null;
        }
    }
}
export class CancellationTokenSource {
    constructor(parent) {
        this._token = undefined;
        this._parentListener = undefined;
        this._parentListener = parent && parent.onCancellationRequested(this.cancel, this);
    }
    get token() {
        if (!this._token) {
            // be lazy and create the token only when
            // actually needed
            this._token = new MutableToken();
        }
        return this._token;
    }
    cancel() {
        if (!this._token) {
            // save an object by returning the default
            // cancelled token when cancellation happens
            // before someone asks for the token
            this._token = CancellationToken.Cancelled;
        }
        else if (this._token instanceof MutableToken) {
            // actually cancel
            this._token.cancel();
        }
    }
    dispose(cancel = false) {
        if (cancel) {
            this.cancel();
        }
        this._parentListener?.dispose();
        if (!this._token) {
            // ensure to initialize with an empty token if we had none
            this._token = CancellationToken.None;
        }
        else if (this._token instanceof MutableToken) {
            // actually dispose
            this._token.dispose();
        }
    }
}
export function cancelOnDispose(store) {
    const source = new CancellationTokenSource();
    store.add({ dispose() { source.cancel(); } });
    return source.token;
}
/**
 * A pool that aggregates multiple cancellation tokens. The pool's own token
 * (accessible via `pool.token`) is cancelled only after every token added
 * to the pool has been cancelled. Adding tokens after the pool token has
 * been cancelled has no effect.
 */
export class CancellationTokenPool {
    constructor() {
        this._source = new CancellationTokenSource();
        this._listeners = new DisposableStore();
        this._total = 0;
        this._cancelled = 0;
        this._isDone = false;
    }
    get token() {
        return this._source.token;
    }
    /**
     * Add a token to the pool. If the token is already cancelled it is counted
     * immediately. Tokens added after the pool token has been cancelled are ignored.
     */
    add(token) {
        if (this._isDone) {
            return;
        }
        this._total++;
        if (token.isCancellationRequested) {
            this._cancelled++;
            this._check();
            return;
        }
        const d = token.onCancellationRequested(() => {
            d.dispose();
            this._cancelled++;
            this._check();
        });
        this._listeners.add(d);
    }
    _check() {
        if (!this._isDone && this._total > 0 && this._total === this._cancelled) {
            this._isDone = true;
            this._listeners.dispose();
            this._source.cancel();
        }
    }
    dispose() {
        this._listeners.dispose();
        this._source.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FuY2VsbGF0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM1QyxPQUFPLEVBQUUsZUFBZSxFQUFlLE1BQU0sZ0JBQWdCLENBQUM7QUFvQjlELE1BQU0sYUFBYSxHQUFnQixNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsUUFBUSxFQUFFLE9BQVE7SUFDNUUsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDckQsT0FBTyxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUNoRCxDQUFDLENBQUMsQ0FBQztBQUVILE1BQU0sS0FBVyxpQkFBaUIsQ0EwQmpDO0FBMUJELFdBQWlCLGlCQUFpQjtJQUVqQyxTQUFnQixtQkFBbUIsQ0FBQyxLQUFjO1FBQ2pELElBQUksS0FBSyxLQUFLLGlCQUFpQixDQUFDLElBQUksSUFBSSxLQUFLLEtBQUssaUJBQWlCLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDL0UsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsSUFBSSxLQUFLLFlBQVksWUFBWSxFQUFFLENBQUM7WUFDbkMsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsSUFBSSxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUN6QyxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLE9BQVEsS0FBMkIsQ0FBQyx1QkFBdUIsS0FBSyxTQUFTO2VBQzVFLE9BQVEsS0FBMkIsQ0FB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