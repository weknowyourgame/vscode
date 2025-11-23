/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DebugLocation } from '../debugLocation.js';
import { getFunctionName } from '../debugName.js';
import { getLogger, logObservable } from '../logging/logging.js';
let _derived;
/**
 * @internal
 * This is to allow splitting files.
*/
export function _setDerivedOpts(derived) {
    _derived = derived;
}
let _recomputeInitiallyAndOnChange;
export function _setRecomputeInitiallyAndOnChange(recomputeInitiallyAndOnChange) {
    _recomputeInitiallyAndOnChange = recomputeInitiallyAndOnChange;
}
let _keepObserved;
export function _setKeepObserved(keepObserved) {
    _keepObserved = keepObserved;
}
let _debugGetObservableGraph;
export function _setDebugGetObservableGraph(debugGetObservableGraph) {
    _debugGetObservableGraph = debugGetObservableGraph;
}
export class ConvenientObservable {
    get TChange() { return null; }
    reportChanges() {
        this.get();
    }
    /** @sealed */
    read(reader) {
        if (reader) {
            return reader.readObservable(this);
        }
        else {
            return this.get();
        }
    }
    map(fnOrOwner, fnOrUndefined, debugLocation = DebugLocation.ofCaller()) {
        const owner = fnOrUndefined === undefined ? undefined : fnOrOwner;
        const fn = fnOrUndefined === undefined ? fnOrOwner : fnOrUndefined;
        return _derived({
            owner,
            debugName: () => {
                const name = getFunctionName(fn);
                if (name !== undefined) {
                    return name;
                }
                // regexp to match `x => x.y` or `x => x?.y` where x and y can be arbitrary identifiers (uses backref):
                const regexp = /^\s*\(?\s*([a-zA-Z_$][a-zA-Z_$0-9]*)\s*\)?\s*=>\s*\1(?:\??)\.([a-zA-Z_$][a-zA-Z_$0-9]*)\s*$/;
                const match = regexp.exec(fn.toString());
                if (match) {
                    return `${this.debugName}.${match[2]}`;
                }
                if (!owner) {
                    return `${this.debugName} (mapped)`;
                }
                return undefined;
            },
            debugReferenceFn: fn,
        }, (reader) => fn(this.read(reader), reader), debugLocation);
    }
    /**
     * @sealed
     * Converts an observable of an observable value into a direct observable of the value.
    */
    flatten() {
        return _derived({
            owner: undefined,
            debugName: () => `${this.debugName} (flattened)`,
        }, (reader) => this.read(reader).read(reader));
    }
    recomputeInitiallyAndOnChange(store, handleValue) {
        store.add(_recomputeInitiallyAndOnChange(this, handleValue));
        return this;
    }
    /**
     * Ensures that this observable is observed. This keeps the cache alive.
     * However, in case of deriveds, it does not force eager evaluation (only when the value is read/get).
     * Use `recomputeInitiallyAndOnChange` for eager evaluation.
     */
    keepObserved(store) {
        store.add(_keepObserved(this));
        return this;
    }
    get debugValue() {
        return this.get();
    }
    get debug() {
        return new DebugHelper(this);
    }
}
class DebugHelper {
    constructor(observable) {
        this.observable = observable;
    }
    getDependencyGraph() {
        return _debugGetObservableGraph(this.observable, { type: 'dependencies' });
    }
    getObserverGraph() {
        return _debugGetObservableGraph(this.observable, { type: 'observers' });
    }
}
export class BaseObservable extends ConvenientObservable {
    constructor(debugLocation) {
        super();
        this._observers = new Set();
        getLogger()?.handleObservableCreated(this, debugLocation);
    }
    addObserver(observer) {
        const len = this._observers.size;
        this._observers.add(observer);
        if (len === 0) {
            this.onFirstObserverAdded();
        }
        if (len !== this._observers.size) {
            getLogger()?.handleOnListenerCountChanged(this, this._observers.size);
        }
    }
    removeObserver(observer) {
        const deleted = this._observers.delete(observer);
        if (deleted && this._observers.size === 0) {
            this.onLastObserverRemoved();
        }
        if (deleted) {
            getLogger()?.handleOnListenerCountChanged(this, this._observers.size);
        }
    }
    onFirstObserverAdded() { }
    onLastObserverRemoved() { }
    log() {
        const hadLogger = !!getLogger();
        logObservable(this);
        if (!hadLogger) {
            getLogger()?.handleObservableCreated(this, DebugLocation.ofCaller());
        }
        return this;
    }
    debugGetObservers() {
        return this._observers;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZU9ic2VydmFibGUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL29ic2VydmFibGVzL2Jhc2VPYnNlcnZhYmxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNwRCxPQUFPLEVBQWMsZUFBZSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFOUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxhQUFhLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUlqRSxJQUFJLFFBQTRCLENBQUM7QUFDakM7OztFQUdFO0FBQ0YsTUFBTSxVQUFVLGVBQWUsQ0FBQyxPQUF3QjtJQUN2RCxRQUFRLEdBQUcsT0FBTyxDQUFDO0FBQ3BCLENBQUM7QUFFRCxJQUFJLDhCQUFvRSxDQUFDO0FBQ3pFLE1BQU0sVUFBVSxpQ0FBaUMsQ0FBQyw2QkFBb0U7SUFDckgsOEJBQThCLEdBQUcsNkJBQTZCLENBQUM7QUFDaEUsQ0FBQztBQUVELElBQUksYUFBa0MsQ0FBQztBQUN2QyxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsWUFBa0M7SUFDbEUsYUFBYSxHQUFHLFlBQVksQ0FBQztBQUM5QixDQUFDO0FBRUQsSUFBSSx3QkFBd0QsQ0FBQztBQUM3RCxNQUFNLFVBQVUsMkJBQTJCLENBQUMsdUJBQXdEO0lBQ25HLHdCQUF3QixHQUFHLHVCQUF1QixDQUFDO0FBQ3BELENBQUM7QUFFRCxNQUFNLE9BQWdCLG9CQUFvQjtJQUN6QyxJQUFJLE9BQU8sS0FBYyxPQUFPLElBQUssQ0FBQyxDQUFDLENBQUM7SUFJakMsYUFBYTtRQUNuQixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDWixDQUFDO0lBS0QsY0FBYztJQUNQLElBQUksQ0FBQyxNQUEyQjtRQUN0QyxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osT0FBTyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BDLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDbkIsQ0FBQztJQUNGLENBQUM7SUFLTSxHQUFHLENBQU8sU0FBNkQsRUFBRSxhQUFtRCxFQUFFLGdCQUErQixhQUFhLENBQUMsUUFBUSxFQUFFO1FBQzNMLE1BQU0sS0FBSyxHQUFHLGFBQWEsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBdUIsQ0FBQztRQUNoRixNQUFNLEVBQUUsR0FBRyxhQUFhLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFnRCxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUM7UUFFMUcsT0FBTyxRQUFRLENBQ2Q7WUFDQyxLQUFLO1lBQ0wsU0FBUyxFQUFFLEdBQUcsRUFBRTtnQkFDZixNQUFNLElBQUksR0FBRyxlQUFlLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2pDLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO29CQUN4QixPQUFPLElBQUksQ0FBQztnQkFDYixDQUFDO2dCQUVELHVHQUF1RztnQkFDdkcsTUFBTSxNQUFNLEdBQUcsNkZBQTZGLENBQUM7Z0JBQzdHLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7Z0JBQ3pDLElBQUksS0FBSyxFQUFFLENBQUM7b0JBQ1gsT0FBTyxHQUFHLElBQUksQ0FBQyxTQUFTLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3hDLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUNaLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxXQUFXLENBQUM7Z0JBQ3JDLENBQUM7Z0JBQ0QsT0FBTyxTQUFTLENBQUM7WUFDbEIsQ0FBQztZQUNELGdCQUFnQixFQUFFLEVBQUU7U0FDcEIsRUFDRCxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLEVBQ3pDLGFBQWEsQ0FDYixDQUFDO0lBQ0gsQ0FBQztJQUlEOzs7TUFHRTtJQUNLLE9BQU87UUFDYixPQUFPLFFBQVEsQ0FDZDtZQUNDLEtBQUssRUFBRSxTQUFTO1lBQ2hCLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLGNBQWM7U0FDaEQsRUFDRCxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQzFDLENBQUM7SUFDSCxDQUFDO0lBRU0sNkJBQTZCLENBQUMsS0FBc0IsRUFBRSxXQUFnQztRQUM1RixLQUFLLENBQUMsR0FBRyxDQUFDLDhCQUErQixDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQzlELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxZQUFZLENBQUMsS0FBc0I7UUFDekMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxhQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNoQyxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFJRCxJQUFjLFVBQVU7UUFDdkIsT0FBTyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDbkIsQ0FBQztJQUVELElBQUksS0FBSztRQUNSLE9BQU8sSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUIsQ0FBQztDQUNEO0FBRUQsTUFBTSxXQUFXO0lBQ2hCLFlBQTRCLFVBQTJDO1FBQTNDLGVBQVUsR0FBVixVQUFVLENBQWlDO0lBQ3ZFLENBQUM7SUFFRCxrQkFBa0I7UUFDakIsT0FBTyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVELGdCQUFnQjtRQUNmLE9BQU8sd0JBQXdCLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBZ0IsY0FBa0MsU0FBUSxvQkFBZ0M7SUFHL0YsWUFBWSxhQUE0QjtRQUN2QyxLQUFLLEVBQUUsQ0FBQztRQUhVLGVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBYSxDQUFDO1FBSXBELFNBQVMsRUFBRSxFQUFFLHVCQUF1QixDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRU0sV0FBVyxDQUFDLFFBQW1CO1FBQ3JDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlCLElBQUksR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDN0IsQ0FBQztRQUNELElBQUksR0FBRyxLQUFLLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDbEMsU0FBUyxFQUFFLEVBQUUsNEJBQTRCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkUsQ0FBQztJQUNGLENBQUM7SUFFTSxjQUFjLENBQUMsUUFBbUI7UUFDeEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakQsSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDM0MsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDOUIsQ0FBQztRQUNELElBQUksT0FBTyxFQUFFLENBQUM7WUFDYixTQUFTLEVBQUUsRUFBRSw0QkFBNEIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2RSxDQUFDO0lBQ0YsQ0FBQztJQUVTLG9CQUFvQixLQUFXLENBQUM7SUFDaEMscUJBQXFCLEtBQVcsQ0FBQztJQUUzQixHQUFHO1FBQ2xCLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNoQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2hCLFNBQVMsRUFBRSxFQUFFLHVCQUF1QixDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU0saUJBQWlCO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQztJQUN4QixDQUFDO0NBQ0QifQ==