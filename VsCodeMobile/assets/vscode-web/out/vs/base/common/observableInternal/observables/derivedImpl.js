/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BaseObservable } from './baseObservable.js';
import { BugIndicatingError, DisposableStore, assertFn, onBugIndicatingError } from '../commonFacade/deps.js';
import { getLogger } from '../logging/logging.js';
export var DerivedState;
(function (DerivedState) {
    /** Initial state, no previous value, recomputation needed */
    DerivedState[DerivedState["initial"] = 0] = "initial";
    /**
     * A dependency could have changed.
     * We need to explicitly ask them if at least one dependency changed.
     */
    DerivedState[DerivedState["dependenciesMightHaveChanged"] = 1] = "dependenciesMightHaveChanged";
    /**
     * A dependency changed and we need to recompute.
     * After recomputation, we need to check the previous value to see if we changed as well.
     */
    DerivedState[DerivedState["stale"] = 2] = "stale";
    /**
     * No change reported, our cached value is up to date.
     */
    DerivedState[DerivedState["upToDate"] = 3] = "upToDate";
})(DerivedState || (DerivedState = {}));
function derivedStateToString(state) {
    switch (state) {
        case 0 /* DerivedState.initial */: return 'initial';
        case 1 /* DerivedState.dependenciesMightHaveChanged */: return 'dependenciesMightHaveChanged';
        case 2 /* DerivedState.stale */: return 'stale';
        case 3 /* DerivedState.upToDate */: return 'upToDate';
        default: return '<unknown>';
    }
}
export class Derived extends BaseObservable {
    get debugName() {
        return this._debugNameData.getDebugName(this) ?? '(anonymous)';
    }
    constructor(_debugNameData, _computeFn, _changeTracker, _handleLastObserverRemoved = undefined, _equalityComparator, debugLocation) {
        super(debugLocation);
        this._debugNameData = _debugNameData;
        this._computeFn = _computeFn;
        this._changeTracker = _changeTracker;
        this._handleLastObserverRemoved = _handleLastObserverRemoved;
        this._equalityComparator = _equalityComparator;
        this._state = 0 /* DerivedState.initial */;
        this._value = undefined;
        this._updateCount = 0;
        this._dependencies = new Set();
        this._dependenciesToBeRemoved = new Set();
        this._changeSummary = undefined;
        this._isUpdating = false;
        this._isComputing = false;
        this._didReportChange = false;
        this._isInBeforeUpdate = false;
        this._isReaderValid = false;
        this._store = undefined;
        this._delayedStore = undefined;
        this._removedObserverToCallEndUpdateOn = null;
        this._changeSummary = this._changeTracker?.createChangeSummary(undefined);
    }
    onLastObserverRemoved() {
        /**
         * We are not tracking changes anymore, thus we have to assume
         * that our cache is invalid.
         */
        this._state = 0 /* DerivedState.initial */;
        this._value = undefined;
        getLogger()?.handleDerivedCleared(this);
        for (const d of this._dependencies) {
            d.removeObserver(this);
        }
        this._dependencies.clear();
        if (this._store !== undefined) {
            this._store.dispose();
            this._store = undefined;
        }
        if (this._delayedStore !== undefined) {
            this._delayedStore.dispose();
            this._delayedStore = undefined;
        }
        this._handleLastObserverRemoved?.();
    }
    get() {
        const checkEnabled = false; // TODO set to true
        if (this._isComputing && checkEnabled) {
            // investigate why this fails in the diff editor!
            throw new BugIndicatingError('Cyclic deriveds are not supported yet!');
        }
        if (this._observers.size === 0) {
            let result;
            // Without observers, we don't know when to clean up stuff.
            // Thus, we don't cache anything to prevent memory leaks.
            try {
                this._isReaderValid = true;
                let changeSummary = undefined;
                if (this._changeTracker) {
                    changeSummary = this._changeTracker.createChangeSummary(undefined);
                    this._changeTracker.beforeUpdate?.(this, changeSummary);
                }
                result = this._computeFn(this, changeSummary);
            }
            finally {
                this._isReaderValid = false;
            }
            // Clear new dependencies
            this.onLastObserverRemoved();
            return result;
        }
        else {
            do {
                // We might not get a notification for a dependency that changed while it is updating,
                // thus we also have to ask all our depedencies if they changed in this case.
                if (this._state === 1 /* DerivedState.dependenciesMightHaveChanged */) {
                    for (const d of this._dependencies) {
                        /** might call {@link handleChange} indirectly, which could make us stale */
                        d.reportChanges();
                        if (this._state === 2 /* DerivedState.stale */) {
                            // The other dependencies will refresh on demand, so early break
                            break;
                        }
                    }
                }
                // We called report changes of all dependencies.
                // If we are still not stale, we can assume to be up to date again.
                if (this._state === 1 /* DerivedState.dependenciesMightHaveChanged */) {
                    this._state = 3 /* DerivedState.upToDate */;
                }
                if (this._state !== 3 /* DerivedState.upToDate */) {
                    this._recompute();
                }
                // In case recomputation changed one of our dependencies, we need to recompute again.
            } while (this._state !== 3 /* DerivedState.upToDate */);
            return this._value;
        }
    }
    _recompute() {
        let didChange = false;
        this._isComputing = true;
        this._didReportChange = false;
        const emptySet = this._dependenciesToBeRemoved;
        this._dependenciesToBeRemoved = this._dependencies;
        this._dependencies = emptySet;
        try {
            const changeSummary = this._changeSummary;
            this._isReaderValid = true;
            if (this._changeTracker) {
                this._isInBeforeUpdate = true;
                this._changeTracker.beforeUpdate?.(this, changeSummary);
                this._isInBeforeUpdate = false;
                this._changeSummary = this._changeTracker?.createChangeSummary(changeSummary);
            }
            const hadValue = this._state !== 0 /* DerivedState.initial */;
            const oldValue = this._value;
            this._state = 3 /* DerivedState.upToDate */;
            const delayedStore = this._delayedStore;
            if (delayedStore !== undefined) {
                this._delayedStore = undefined;
            }
            try {
                if (this._store !== undefined) {
                    this._store.dispose();
                    this._store = undefined;
                }
                /** might call {@link handleChange} indirectly, which could invalidate us */
                this._value = this._computeFn(this, changeSummary);
            }
            finally {
                this._isReaderValid = false;
                // We don't want our observed observables to think that they are (not even temporarily) not being observed.
                // Thus, we only unsubscribe from observables that are definitely not read anymore.
                for (const o of this._dependenciesToBeRemoved) {
                    o.removeObserver(this);
                }
                this._dependenciesToBeRemoved.clear();
                if (delayedStore !== undefined) {
                    delayedStore.dispose();
                }
            }
            didChange = this._didReportChange || (hadValue && !(this._equalityComparator(oldValue, this._value)));
            getLogger()?.handleObservableUpdated(this, {
                oldValue,
                newValue: this._value,
                change: undefined,
                didChange,
                hadValue,
            });
        }
        catch (e) {
            onBugIndicatingError(e);
        }
        this._isComputing = false;
        if (!this._didReportChange && didChange) {
            for (const r of this._observers) {
                r.handleChange(this, undefined);
            }
        }
        else {
            this._didReportChange = false;
        }
    }
    toString() {
        return `LazyDerived<${this.debugName}>`;
    }
    // IObserver Implementation
    beginUpdate(_observable) {
        if (this._isUpdating) {
            throw new BugIndicatingError('Cyclic deriveds are not supported yet!');
        }
        this._updateCount++;
        this._isUpdating = true;
        try {
            const propagateBeginUpdate = this._updateCount === 1;
            if (this._state === 3 /* DerivedState.upToDate */) {
                this._state = 1 /* DerivedState.dependenciesMightHaveChanged */;
                // If we propagate begin update, that will already signal a possible change.
                if (!propagateBeginUpdate) {
                    for (const r of this._observers) {
                        r.handlePossibleChange(this);
                    }
                }
            }
            if (propagateBeginUpdate) {
                for (const r of this._observers) {
                    r.beginUpdate(this); // This signals a possible change
                }
            }
        }
        finally {
            this._isUpdating = false;
        }
    }
    endUpdate(_observable) {
        this._updateCount--;
        if (this._updateCount === 0) {
            // End update could change the observer list.
            const observers = [...this._observers];
            for (const r of observers) {
                r.endUpdate(this);
            }
            if (this._removedObserverToCallEndUpdateOn) {
                const observers = [...this._removedObserverToCallEndUpdateOn];
                this._removedObserverToCallEndUpdateOn = null;
                for (const r of observers) {
                    r.endUpdate(this);
                }
            }
        }
        assertFn(() => this._updateCount >= 0);
    }
    handlePossibleChange(observable) {
        // In all other states, observers already know that we might have changed.
        if (this._state === 3 /* DerivedState.upToDate */ && this._dependencies.has(observable) && !this._dependenciesToBeRemoved.has(observable)) {
            this._state = 1 /* DerivedState.dependenciesMightHaveChanged */;
            for (const r of this._observers) {
                r.handlePossibleChange(this);
            }
        }
    }
    handleChange(observable, change) {
        if (this._dependencies.has(observable) && !this._dependenciesToBeRemoved.has(observable) || this._isInBeforeUpdate) {
            getLogger()?.handleDerivedDependencyChanged(this, observable, change);
            let shouldReact = false;
            try {
                shouldReact = this._changeTracker ? this._changeTracker.handleChange({
                    changedObservable: observable,
                    change,
                    // eslint-disable-next-line local/code-no-any-casts
                    didChange: (o) => o === observable,
                }, this._changeSummary) : true;
            }
            catch (e) {
                onBugIndicatingError(e);
            }
            const wasUpToDate = this._state === 3 /* DerivedState.upToDate */;
            if (shouldReact && (this._state === 1 /* DerivedState.dependenciesMightHaveChanged */ || wasUpToDate)) {
                this._state = 2 /* DerivedState.stale */;
                if (wasUpToDate) {
                    for (const r of this._observers) {
                        r.handlePossibleChange(this);
                    }
                }
            }
        }
    }
    // IReader Implementation
    _ensureReaderValid() {
        if (!this._isReaderValid) {
            throw new BugIndicatingError('The reader object cannot be used outside its compute function!');
        }
    }
    readObservable(observable) {
        this._ensureReaderValid();
        // Subscribe before getting the value to enable caching
        observable.addObserver(this);
        /** This might call {@link handleChange} indirectly, which could invalidate us */
        const value = observable.get();
        // Which is why we only add the observable to the dependencies now.
        this._dependencies.add(observable);
        this._dependenciesToBeRemoved.delete(observable);
        return value;
    }
    reportChange(change) {
        this._ensureReaderValid();
        this._didReportChange = true;
        // TODO add logging
        for (const r of this._observers) {
            r.handleChange(this, change);
        }
    }
    get store() {
        this._ensureReaderValid();
        if (this._store === undefined) {
            this._store = new DisposableStore();
        }
        return this._store;
    }
    get delayedStore() {
        this._ensureReaderValid();
        if (this._delayedStore === undefined) {
            this._delayedStore = new DisposableStore();
        }
        return this._delayedStore;
    }
    addObserver(observer) {
        const shouldCallBeginUpdate = !this._observers.has(observer) && this._updateCount > 0;
        super.addObserver(observer);
        if (shouldCallBeginUpdate) {
            if (!this._removedObserverToCallEndUpdateOn?.delete(observer)) {
                observer.beginUpdate(this);
            }
        }
    }
    removeObserver(observer) {
        if (this._observers.has(observer) && this._updateCount > 0) {
            if (!this._removedObserverToCallEndUpdateOn) {
                this._removedObserverToCallEndUpdateOn = new Set();
            }
            this._removedObserverToCallEndUpdateOn.add(observer);
        }
        super.removeObserver(observer);
    }
    debugGetState() {
        return {
            state: this._state,
            stateStr: derivedStateToString(this._state),
            updateCount: this._updateCount,
            isComputing: this._isComputing,
            dependencies: this._dependencies,
            value: this._value,
        };
    }
    debugSetValue(newValue) {
        // eslint-disable-next-line local/code-no-any-casts
        this._value = newValue;
    }
    debugRecompute() {
        if (!this._isComputing) {
            this._recompute();
        }
        else {
            this._state = 2 /* DerivedState.stale */;
        }
    }
    setValue(newValue, tx, change) {
        this._value = newValue;
        const observers = this._observers;
        tx.updateObserver(this, this);
        for (const d of observers) {
            d.handleChange(this, change);
        }
    }
}
export class DerivedWithSetter extends Derived {
    constructor(debugNameData, computeFn, changeTracker, handleLastObserverRemoved = undefined, equalityComparator, set, debugLocation) {
        super(debugNameData, computeFn, changeTracker, handleLastObserverRemoved, equalityComparator, debugLocation);
        this.set = set;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVyaXZlZEltcGwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL29ic2VydmFibGVzL2Rlcml2ZWRJbXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUVyRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxFQUFvQixRQUFRLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUNoSSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFXbEQsTUFBTSxDQUFOLElBQWtCLFlBb0JqQjtBQXBCRCxXQUFrQixZQUFZO0lBQzdCLDZEQUE2RDtJQUM3RCxxREFBVyxDQUFBO0lBRVg7OztPQUdHO0lBQ0gsK0ZBQWdDLENBQUE7SUFFaEM7OztPQUdHO0lBQ0gsaURBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsdURBQVksQ0FBQTtBQUNiLENBQUMsRUFwQmlCLFlBQVksS0FBWixZQUFZLFFBb0I3QjtBQUVELFNBQVMsb0JBQW9CLENBQUMsS0FBbUI7SUFDaEQsUUFBUSxLQUFLLEVBQUUsQ0FBQztRQUNmLGlDQUF5QixDQUFDLENBQUMsT0FBTyxTQUFTLENBQUM7UUFDNUMsc0RBQThDLENBQUMsQ0FBQyxPQUFPLDhCQUE4QixDQUFDO1FBQ3RGLCtCQUF1QixDQUFDLENBQUMsT0FBTyxPQUFPLENBQUM7UUFDeEMsa0NBQTBCLENBQUMsQ0FBQyxPQUFPLFVBQVUsQ0FBQztRQUM5QyxPQUFPLENBQUMsQ0FBQyxPQUFPLFdBQVcsQ0FBQztJQUM3QixDQUFDO0FBQ0YsQ0FBQztBQUVELE1BQU0sT0FBTyxPQUFpRCxTQUFRLGNBQTBCO0lBZ0IvRixJQUFvQixTQUFTO1FBQzVCLE9BQU8sSUFBSSxDQUFDLGNBQWMs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