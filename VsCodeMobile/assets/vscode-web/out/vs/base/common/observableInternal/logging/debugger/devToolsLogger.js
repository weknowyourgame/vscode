/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AutorunObserver } from '../../reactions/autorunImpl.js';
import { formatValue } from '../consoleObservableLogger.js';
import { registerDebugChannel } from './debuggerRpc.js';
import { deepAssign, deepAssignDeleteNulls, Throttler } from './utils.js';
import { isDefined } from '../../../types.js';
import { FromEventObservable } from '../../observables/observableFromEvent.js';
import { BugIndicatingError, onUnexpectedError } from '../../../errors.js';
import { Derived } from '../../observables/derivedImpl.js';
import { ObservableValue } from '../../observables/observableValue.js';
import { DebugLocation } from '../../debugLocation.js';
export class DevToolsLogger {
    static { this._instance = undefined; }
    static getInstance() {
        if (DevToolsLogger._instance === undefined) {
            DevToolsLogger._instance = new DevToolsLogger();
        }
        return DevToolsLogger._instance;
    }
    getTransactionState() {
        const affected = [];
        const txs = [...this._activeTransactions];
        if (txs.length === 0) {
            return undefined;
        }
        const observerQueue = txs.flatMap(t => t.debugGetUpdatingObservers() ?? []).map(o => o.observer);
        const processedObservers = new Set();
        while (observerQueue.length > 0) {
            const observer = observerQueue.shift();
            if (processedObservers.has(observer)) {
                continue;
            }
            processedObservers.add(observer);
            const state = this._getInfo(observer, d => {
                if (!processedObservers.has(d)) {
                    observerQueue.push(d);
                }
            });
            if (state) {
                affected.push(state);
            }
        }
        return { names: txs.map(t => t.getDebugName() ?? 'tx'), affected };
    }
    _getObservableInfo(observable) {
        const info = this._instanceInfos.get(observable);
        if (!info) {
            onUnexpectedError(new BugIndicatingError('No info found'));
            return undefined;
        }
        return info;
    }
    _getAutorunInfo(autorun) {
        const info = this._instanceInfos.get(autorun);
        if (!info) {
            onUnexpectedError(new BugIndicatingError('No info found'));
            return undefined;
        }
        return info;
    }
    _getInfo(observer, queue) {
        if (observer instanceof Derived) {
            const observersToUpdate = [...observer.debugGetObservers()];
            for (const o of observersToUpdate) {
                queue(o);
            }
            const info = this._getObservableInfo(observer);
            if (!info) {
                return;
            }
            const observerState = observer.debugGetState();
            const base = { name: observer.debugName, instanceId: info.instanceId, updateCount: observerState.updateCount };
            const changedDependencies = [...info.changedObservables].map(o => this._instanceInfos.get(o)?.instanceId).filter(isDefined);
            if (observerState.isComputing) {
                return { ...base, type: 'observable/derived', state: 'updating', changedDependencies, initialComputation: false };
            }
            switch (observerState.state) {
                case 0 /* DerivedState.initial */:
                    return { ...base, type: 'observable/derived', state: 'noValue' };
                case 3 /* DerivedState.upToDate */:
                    return { ...base, type: 'observable/derived', state: 'upToDate' };
                case 2 /* DerivedState.stale */:
                    return { ...base, type: 'observable/derived', state: 'stale', changedDependencies };
                case 1 /* DerivedState.dependenciesMightHaveChanged */:
                    return { ...base, type: 'observable/derived', state: 'possiblyStale' };
            }
        }
        else if (observer instanceof AutorunObserver) {
            const info = this._getAutorunInfo(observer);
            if (!info) {
                return undefined;
            }
            const base = { name: observer.debugName, instanceId: info.instanceId, updateCount: info.updateCount };
            const changedDependencies = [...info.changedObservables].map(o => this._instanceInfos.get(o).instanceId);
            if (observer.debugGetState().isRunning) {
                return { ...base, type: 'autorun', state: 'updating', changedDependencies };
            }
            switch (observer.debugGetState().state) {
                case 3 /* AutorunState.upToDate */:
                    return { ...base, type: 'autorun', state: 'upToDate' };
                case 2 /* AutorunState.stale */:
                    return { ...base, type: 'autorun', state: 'stale', changedDependencies };
                case 1 /* AutorunState.dependenciesMightHaveChanged */:
                    return { ...base, type: 'autorun', state: 'possiblyStale' };
            }
        }
        return undefined;
    }
    _formatObservable(obs) {
        const info = this._getObservableInfo(obs);
        if (!info) {
            return undefined;
        }
        return { name: obs.debugName, instanceId: info.instanceId };
    }
    _formatObserver(obs) {
        if (obs instanceof Derived) {
            return { name: obs.toString(), instanceId: this._getObservableInfo(obs)?.instanceId };
        }
        const autorunInfo = this._getAutorunInfo(obs);
        if (autorunInfo) {
            return { name: obs.toString(), instanceId: autorunInfo.instanceId };
        }
        return undefined;
    }
    constructor() {
        this._declarationId = 0;
        this._instanceId = 0;
        this._declarations = new Map();
        this._instanceInfos = new WeakMap();
        this._aliveInstances = new Map();
        this._activeTransactions = new Set();
        this._channel = registerDebugChannel('observableDevTools', () => {
            return {
                notifications: {
                    setDeclarationIdFilter: declarationIds => {
                    },
                    logObservableValue: (observableId) => {
                        console.log('logObservableValue', observableId);
                    },
                    flushUpdates: () => {
                        this._flushUpdates();
                    },
                    resetUpdates: () => {
                        this._pendingChanges = null;
                        this._channel.api.notifications.handleChange(this._fullState, true);
                    },
                },
                requests: {
                    getDeclarations: () => {
                        const result = {};
                        for (const decl of this._declarations.values()) {
                            result[decl.id] = decl;
                        }
                        return { decls: result };
                    },
                    getSummarizedInstances: () => {
                        return null;
                    },
                    getObservableValueInfo: instanceId => {
                        const obs = this._aliveInstances.get(instanceId);
                        return {
                            observers: [...obs.debugGetObservers()].map(d => this._formatObserver(d)).filter(isDefined),
                        };
                    },
                    getDerivedInfo: instanceId => {
                        const d = this._aliveInstances.get(instanceId);
                        return {
                            dependencies: [...d.debugGetState().dependencies].map(d => this._formatObservable(d)).filter(isDefined),
                            observers: [...d.debugGetObservers()].map(d => this._formatObserver(d)).filter(isDefined),
                        };
                    },
                    getAutorunInfo: instanceId => {
                        const obs = this._aliveInstances.get(instanceId);
                        return {
                            dependencies: [...obs.debugGetState().dependencies].map(d => this._formatObservable(d)).filter(isDefined),
                        };
                    },
                    getTransactionState: () => {
                        return this.getTransactionState();
                    },
                    setValue: (instanceId, jsonValue) => {
                        const obs = this._aliveInstances.get(instanceId);
                        if (obs instanceof Derived) {
                            obs.debugSetValue(jsonValue);
                        }
                        else if (obs instanceof ObservableValue) {
                            obs.debugSetValue(jsonValue);
                        }
                        else if (obs instanceof FromEventObservable) {
                            obs.debugSetValue(jsonValue);
                        }
                        else {
                            throw new BugIndicatingError('Observable is not supported');
                        }
                        const observers = [...obs.debugGetObservers()];
                        for (const d of observers) {
                            d.beginUpdate(obs);
                        }
                        for (const d of observers) {
                            d.handleChange(obs, undefined);
                        }
                        for (const d of observers) {
                            d.endUpdate(obs);
                        }
                    },
                    getValue: instanceId => {
                        const obs = this._aliveInstances.get(instanceId);
                        if (obs instanceof Derived) {
                            return formatValue(obs.debugGetState().value, 200);
                        }
                        else if (obs instanceof ObservableValue) {
                            return formatValue(obs.debugGetState().value, 200);
                        }
                        return undefined;
                    },
                    logValue: (instanceId) => {
                        const obs = this._aliveInstances.get(instanceId);
                        if (obs && 'get' in obs) {
                            console.log('Logged Value:', obs.get());
                        }
                        else {
                            throw new BugIndicatingError('Observable is not supported');
                        }
                    },
                    rerun: (instanceId) => {
                        const obs = this._aliveInstances.get(instanceId);
                        if (obs instanceof Derived) {
                            obs.debugRecompute();
                        }
                        else if (obs instanceof AutorunObserver) {
                            obs.debugRerun();
                        }
                        else {
                            throw new BugIndicatingError('Observable is not supported');
                        }
                    },
                }
            };
        });
        this._pendingChanges = null;
        this._changeThrottler = new Throttler();
        this._fullState = {};
        this._flushUpdates = () => {
            if (this._pendingChanges !== null) {
                this._channel.api.notifications.handleChange(this._pendingChanges, false);
                this._pendingChanges = null;
            }
        };
        DebugLocation.enable();
    }
    _handleChange(update) {
        deepAssignDeleteNulls(this._fullState, update);
        if (this._pendingChanges === null) {
            this._pendingChanges = update;
        }
        else {
            deepAssign(this._pendingChanges, update);
        }
        this._changeThrottler.throttle(this._flushUpdates, 10);
    }
    _getDeclarationId(type, location) {
        if (!location) {
            return -1;
        }
        let decInfo = this._declarations.get(location.id);
        if (decInfo === undefined) {
            decInfo = {
                id: this._declarationId++,
                type,
                url: location.fileName,
                line: location.line,
                column: location.column,
            };
            this._declarations.set(location.id, decInfo);
            this._handleChange({ decls: { [decInfo.id]: decInfo } });
        }
        return decInfo.id;
    }
    handleObservableCreated(observable, location) {
        const declarationId = this._getDeclarationId('observable/value', location);
        const info = {
            declarationId,
            instanceId: this._instanceId++,
            listenerCount: 0,
            lastValue: undefined,
            updateCount: 0,
            changedObservables: new Set(),
        };
        this._instanceInfos.set(observable, info);
    }
    handleOnListenerCountChanged(observable, newCount) {
        const info = this._getObservableInfo(observable);
        if (!info) {
            return;
        }
        if (info.listenerCount === 0 && newCount > 0) {
            const type = observable instanceof Derived ? 'observable/derived' : 'observable/value';
            this._aliveInstances.set(info.instanceId, observable);
            this._handleChange({
                instances: {
                    [info.instanceId]: {
                        instanceId: info.instanceId,
                        declarationId: info.declarationId,
                        formattedValue: info.lastValue,
                        type,
                        name: observable.debugName,
                    }
                }
            });
        }
        else if (info.listenerCount > 0 && newCount === 0) {
            this._handleChange({
                instances: { [info.instanceId]: null }
            });
            this._aliveInstances.delete(info.instanceId);
        }
        info.listenerCount = newCount;
    }
    handleObservableUpdated(observable, changeInfo) {
        if (observable instanceof Derived) {
            this._handleDerivedRecomputed(observable, changeInfo);
            return;
        }
        const info = this._getObservableInfo(observable);
        if (info) {
            if (changeInfo.didChange) {
                info.lastValue = formatValue(changeInfo.newValue, 30);
                if (info.listenerCount > 0) {
                    this._handleChange({
                        instances: { [info.instanceId]: { formattedValue: info.lastValue } }
                    });
                }
            }
        }
    }
    handleAutorunCreated(autorun, location) {
        const declarationId = this._getDeclarationId('autorun', location);
        const info = {
            declarationId,
            instanceId: this._instanceId++,
            updateCount: 0,
            changedObservables: new Set(),
        };
        this._instanceInfos.set(autorun, info);
        this._aliveInstances.set(info.instanceId, autorun);
        if (info) {
            this._handleChange({
                instances: {
                    [info.instanceId]: {
                        instanceId: info.instanceId,
                        declarationId: info.declarationId,
                        runCount: 0,
                        type: 'autorun',
                        name: autorun.debugName,
                    }
                }
            });
        }
    }
    handleAutorunDisposed(autorun) {
        const info = this._getAutorunInfo(autorun);
        if (!info) {
            return;
        }
        this._handleChange({
            instances: { [info.instanceId]: null }
        });
        this._instanceInfos.delete(autorun);
        this._aliveInstances.delete(info.instanceId);
    }
    handleAutorunDependencyChanged(autorun, observable, change) {
        const info = this._getAutorunInfo(autorun);
        if (!info) {
            return;
        }
        info.changedObservables.add(observable);
    }
    handleAutorunStarted(autorun) {
    }
    handleAutorunFinished(autorun) {
        const info = this._getAutorunInfo(autorun);
        if (!info) {
            return;
        }
        info.changedObservables.clear();
        info.updateCount++;
        this._handleChange({
            instances: { [info.instanceId]: { runCount: info.updateCount } }
        });
    }
    handleDerivedDependencyChanged(derived, observable, change) {
        const info = this._getObservableInfo(derived);
        if (info) {
            info.changedObservables.add(observable);
        }
    }
    _handleDerivedRecomputed(observable, changeInfo) {
        const info = this._getObservableInfo(observable);
        if (!info) {
            return;
        }
        const formattedValue = formatValue(changeInfo.newValue, 30);
        info.updateCount++;
        info.changedObservables.clear();
        info.lastValue = formattedValue;
        if (info.listenerCount > 0) {
            this._handleChange({
                instances: { [info.instanceId]: { formattedValue: formattedValue, recomputationCount: info.updateCount } }
            });
        }
    }
    handleDerivedCleared(observable) {
        const info = this._getObservableInfo(observable);
        if (!info) {
            return;
        }
        info.lastValue = undefined;
        info.changedObservables.clear();
        if (info.listenerCount > 0) {
            this._handleChange({
                instances: {
                    [info.instanceId]: {
                        formattedValue: undefined,
                    }
                }
            });
        }
    }
    handleBeginTransaction(transaction) {
        this._activeTransactions.add(transaction);
    }
    handleEndTransaction(transaction) {
        this._activeTransactions.delete(transaction);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2VG9vbHNMb2dnZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL2xvZ2dpbmcvZGVidWdnZXIvZGV2VG9vbHNMb2dnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBZ0IsTUFBTSxnQ0FBZ0MsQ0FBQztBQUcvRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFNUQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDeEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxxQkFBcUIsRUFBRSxTQUFTLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDMUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRzNFLE9BQU8sRUFBRSxPQUFPLEVBQWdCLE1BQU0sa0NBQWtDLENBQUM7QUFDekUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQW1CdkQsTUFBTSxPQUFPLGNBQWM7YUFDWCxjQUFTLEdBQStCLFNBQVMsQUFBeEMsQ0FBeUM7SUFDMUQsTUFBTSxDQUFDLFdBQVc7UUFDeEIsSUFBSSxjQUFjLENBQUMsU0FBUyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzVDLGNBQWMsQ0FBQyxTQUFTLEdBQUcsSUFBSSxjQUFjLEVBQUUsQ0FBQztRQUNqRCxDQUFDO1FBQ0QsT0FBTyxjQUFjLENBQUMsU0FBUyxDQUFDO0lBQ2pDLENBQUM7SUFv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