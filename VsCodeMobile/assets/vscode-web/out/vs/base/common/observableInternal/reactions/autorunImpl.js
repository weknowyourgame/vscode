/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assertFn, BugIndicatingError, DisposableStore, markAsDisposed, onBugIndicatingError, trackDisposable } from '../commonFacade/deps.js';
import { getLogger } from '../logging/logging.js';
export var AutorunState;
(function (AutorunState) {
    /**
     * A dependency could have changed.
     * We need to explicitly ask them if at least one dependency changed.
     */
    AutorunState[AutorunState["dependenciesMightHaveChanged"] = 1] = "dependenciesMightHaveChanged";
    /**
     * A dependency changed and we need to recompute.
     */
    AutorunState[AutorunState["stale"] = 2] = "stale";
    AutorunState[AutorunState["upToDate"] = 3] = "upToDate";
})(AutorunState || (AutorunState = {}));
function autorunStateToString(state) {
    switch (state) {
        case 1 /* AutorunState.dependenciesMightHaveChanged */: return 'dependenciesMightHaveChanged';
        case 2 /* AutorunState.stale */: return 'stale';
        case 3 /* AutorunState.upToDate */: return 'upToDate';
        default: return '<unknown>';
    }
}
export class AutorunObserver {
    get debugName() {
        return this._debugNameData.getDebugName(this) ?? '(anonymous)';
    }
    constructor(_debugNameData, _runFn, _changeTracker, debugLocation) {
        this._debugNameData = _debugNameData;
        this._runFn = _runFn;
        this._changeTracker = _changeTracker;
        this._state = 2 /* AutorunState.stale */;
        this._updateCount = 0;
        this._disposed = false;
        this._dependencies = new Set();
        this._dependenciesToBeRemoved = new Set();
        this._isRunning = false;
        this._store = undefined;
        this._delayedStore = undefined;
        this._changeSummary = this._changeTracker?.createChangeSummary(undefined);
        getLogger()?.handleAutorunCreated(this, debugLocation);
        this._run();
        trackDisposable(this);
    }
    dispose() {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        for (const o of this._dependencies) {
            o.removeObserver(this); // Warning: external call!
        }
        this._dependencies.clear();
        if (this._store !== undefined) {
            this._store.dispose();
        }
        if (this._delayedStore !== undefined) {
            this._delayedStore.dispose();
        }
        getLogger()?.handleAutorunDisposed(this);
        markAsDisposed(this);
    }
    _run() {
        const emptySet = this._dependenciesToBeRemoved;
        this._dependenciesToBeRemoved = this._dependencies;
        this._dependencies = emptySet;
        this._state = 3 /* AutorunState.upToDate */;
        try {
            if (!this._disposed) {
                getLogger()?.handleAutorunStarted(this);
                const changeSummary = this._changeSummary;
                const delayedStore = this._delayedStore;
                if (delayedStore !== undefined) {
                    this._delayedStore = undefined;
                }
                try {
                    this._isRunning = true;
                    if (this._changeTracker) {
                        this._changeTracker.beforeUpdate?.(this, changeSummary);
                        this._changeSummary = this._changeTracker.createChangeSummary(changeSummary); // Warning: external call!
                    }
                    if (this._store !== undefined) {
                        this._store.dispose();
                        this._store = undefined;
                    }
                    this._runFn(this, changeSummary); // Warning: external call!
                }
                catch (e) {
                    onBugIndicatingError(e);
                }
                finally {
                    this._isRunning = false;
                    if (delayedStore !== undefined) {
                        delayedStore.dispose();
                    }
                }
            }
        }
        finally {
            if (!this._disposed) {
                getLogger()?.handleAutorunFinished(this);
            }
            // We don't want our observed observables to think that they are (not even temporarily) not being observed.
            // Thus, we only unsubscribe from observables that are definitely not read anymore.
            for (const o of this._dependenciesToBeRemoved) {
                o.removeObserver(this); // Warning: external call!
            }
            this._dependenciesToBeRemoved.clear();
        }
    }
    toString() {
        return `Autorun<${this.debugName}>`;
    }
    // IObserver implementation
    beginUpdate(_observable) {
        if (this._state === 3 /* AutorunState.upToDate */) {
            this._state = 1 /* AutorunState.dependenciesMightHaveChanged */;
        }
        this._updateCount++;
    }
    endUpdate(_observable) {
        try {
            if (this._updateCount === 1) {
                do {
                    if (this._state === 1 /* AutorunState.dependenciesMightHaveChanged */) {
                        this._state = 3 /* AutorunState.upToDate */;
                        for (const d of this._dependencies) {
                            d.reportChanges(); // Warning: external call!
                            if (this._state === 2 /* AutorunState.stale */) {
                                // The other dependencies will refresh on demand
                                break;
                            }
                        }
                    }
                    if (this._state !== 3 /* AutorunState.upToDate */) {
                        this._run(); // Warning: indirect external call!
                    }
                } while (this._state !== 3 /* AutorunState.upToDate */);
            }
        }
        finally {
            this._updateCount--;
        }
        assertFn(() => this._updateCount >= 0);
    }
    handlePossibleChange(observable) {
        if (this._state === 3 /* AutorunState.upToDate */ && this._isDependency(observable)) {
            this._state = 1 /* AutorunState.dependenciesMightHaveChanged */;
        }
    }
    handleChange(observable, change) {
        if (this._isDependency(observable)) {
            getLogger()?.handleAutorunDependencyChanged(this, observable, change);
            try {
                // Warning: external call!
                const shouldReact = this._changeTracker ? this._changeTracker.handleChange({
                    changedObservable: observable,
                    change,
                    // eslint-disable-next-line local/code-no-any-casts
                    didChange: (o) => o === observable,
                }, this._changeSummary) : true;
                if (shouldReact) {
                    this._state = 2 /* AutorunState.stale */;
                }
            }
            catch (e) {
                onBugIndicatingError(e);
            }
        }
    }
    _isDependency(observable) {
        return this._dependencies.has(observable) && !this._dependenciesToBeRemoved.has(observable);
    }
    // IReader implementation
    _ensureNoRunning() {
        if (!this._isRunning) {
            throw new BugIndicatingError('The reader object cannot be used outside its compute function!');
        }
    }
    readObservable(observable) {
        this._ensureNoRunning();
        // In case the run action disposes the autorun
        if (this._disposed) {
            return observable.get(); // warning: external call!
        }
        observable.addObserver(this); // warning: external call!
        const value = observable.get(); // warning: external call!
        this._dependencies.add(observable);
        this._dependenciesToBeRemoved.delete(observable);
        return value;
    }
    get store() {
        this._ensureNoRunning();
        if (this._disposed) {
            throw new BugIndicatingError('Cannot access store after dispose');
        }
        if (this._store === undefined) {
            this._store = new DisposableStore();
        }
        return this._store;
    }
    get delayedStore() {
        this._ensureNoRunning();
        if (this._disposed) {
            throw new BugIndicatingError('Cannot access store after dispose');
        }
        if (this._delayedStore === undefined) {
            this._delayedStore = new DisposableStore();
        }
        return this._delayedStore;
    }
    debugGetState() {
        return {
            isRunning: this._isRunning,
            updateCount: this._updateCount,
            dependencies: this._dependencies,
            state: this._state,
            stateStr: autorunStateToString(this._state),
        };
    }
    debugRerun() {
        if (!this._isRunning) {
            this._run();
        }
        else {
            this._state = 2 /* AutorunState.stale */;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b3J1bkltcGwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL3JlYWN0aW9ucy9hdXRvcnVuSW1wbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsUUFBUSxFQUFFLGtCQUFrQixFQUFFLGVBQWUsRUFBZSxjQUFjLEVBQUUsb0JBQW9CLEVBQUUsZUFBZSxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDNUosT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBSWxELE1BQU0sQ0FBTixJQUFrQixZQVlqQjtBQVpELFdBQWtCLFlBQVk7SUFDN0I7OztPQUdHO0lBQ0gsK0ZBQWdDLENBQUE7SUFFaEM7O09BRUc7SUFDSCxpREFBUyxDQUFBO0lBQ1QsdURBQVksQ0FBQTtBQUNiLENBQUMsRUFaaUIsWUFBWSxLQUFaLFlBQVksUUFZN0I7QUFFRCxTQUFTLG9CQUFvQixDQUFDLEtBQW1CO0lBQ2hELFFBQVEsS0FBSyxFQUFFLENBQUM7UUFDZixzREFBOEMsQ0FBQyxDQUFDLE9BQU8sOEJBQThCLENBQUM7UUFDdEYsK0JBQXVCLENBQUMsQ0FBQyxPQUFPLE9BQU8sQ0FBQztRQUN4QyxrQ0FBMEIsQ0FBQyxDQUFDLE9BQU8sVUFBVSxDQUFDO1FBQzlDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sV0FBVyxDQUFDO0lBQzdCLENBQUM7QUFDRixDQUFDO0FBRUQsTUFBTSxPQUFPLGVBQWU7SUFTM0IsSUFBVyxTQUFTO1FBQ25CLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksYUFBYSxDQUFDO0lBQ2hFLENBQUM7SUFFRCxZQUNpQixjQUE2QixFQUM3QixNQUF5RSxFQUN4RSxjQUEwRCxFQUMzRSxhQUE0QjtRQUhaLG1CQUFjLEdBQWQsY0FB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