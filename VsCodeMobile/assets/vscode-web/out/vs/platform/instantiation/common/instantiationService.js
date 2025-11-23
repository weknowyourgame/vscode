/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { GlobalIdleValue } from '../../../base/common/async.js';
import { illegalState } from '../../../base/common/errors.js';
import { dispose, isDisposable, toDisposable } from '../../../base/common/lifecycle.js';
import { SyncDescriptor } from './descriptors.js';
import { Graph } from './graph.js';
import { IInstantiationService, _util } from './instantiation.js';
import { ServiceCollection } from './serviceCollection.js';
import { LinkedList } from '../../../base/common/linkedList.js';
// TRACING
const _enableAllTracing = false;
class CyclicDependencyError extends Error {
    constructor(graph) {
        super('cyclic dependency between services');
        this.message = graph.findCycleSlow() ?? `UNABLE to detect cycle, dumping graph: \n${graph.toString()}`;
    }
}
export class InstantiationService {
    constructor(_services = new ServiceCollection(), _strict = false, _parent, _enableTracing = _enableAllTracing) {
        this._services = _services;
        this._strict = _strict;
        this._parent = _parent;
        this._enableTracing = _enableTracing;
        this._isDisposed = false;
        this._servicesToMaybeDispose = new Set();
        this._children = new Set();
        this._activeInstantiations = new Set();
        this._services.set(IInstantiationService, this);
        this._globalGraph = _enableTracing ? _parent?._globalGraph ?? new Graph(e => e) : undefined;
    }
    dispose() {
        if (!this._isDisposed) {
            this._isDisposed = true;
            // dispose all child services
            dispose(this._children);
            this._children.clear();
            // dispose all services created by this service
            for (const candidate of this._servicesToMaybeDispose) {
                if (isDisposable(candidate)) {
                    candidate.dispose();
                }
            }
            this._servicesToMaybeDispose.clear();
        }
    }
    _throwIfDisposed() {
        if (this._isDisposed) {
            throw new Error('InstantiationService has been disposed');
        }
    }
    createChild(services, store) {
        this._throwIfDisposed();
        const that = this;
        const result = new class extends InstantiationService {
            dispose() {
                that._children.delete(result);
                super.dispose();
            }
        }(services, this._strict, this, this._enableTracing);
        this._children.add(result);
        store?.add(result);
        return result;
    }
    invokeFunction(fn, ...args) {
        this._throwIfDisposed();
        const _trace = Trace.traceInvocation(this._enableTracing, fn);
        let _done = false;
        try {
            const accessor = {
                get: (id) => {
                    if (_done) {
                        throw illegalState('service accessor is only valid during the invocation of its target method');
                    }
                    const result = this._getOrCreateServiceInstance(id, _trace);
                    if (!result) {
                        throw new Error(`[invokeFunction] unknown service '${id}'`);
                    }
                    return result;
                },
                getIfExists: (id) => {
                    if (_done) {
                        throw illegalState('service accessor is only valid during the invocation of its target method');
                    }
                    const result = this._getOrCreateServiceInstance(id, _trace);
                    return result;
                }
            };
            return fn(accessor, ...args);
        }
        finally {
            _done = true;
            _trace.stop();
        }
    }
    createInstance(ctorOrDescriptor, ...rest) {
        this._throwIfDisposed();
        let _trace;
        let result;
        if (ctorOrDescriptor instanceof SyncDescriptor) {
            _trace = Trace.traceCreation(this._enableTracing, ctorOrDescriptor.ctor);
            result = this._createInstance(ctorOrDescriptor.ctor, ctorOrDescriptor.staticArguments.concat(rest), _trace);
        }
        else {
            _trace = Trace.traceCreation(this._enableTracing, ctorOrDescriptor);
            result = this._createInstance(ctorOrDescriptor, rest, _trace);
        }
        _trace.stop();
        return result;
    }
    _createInstance(ctor, args = [], _trace) {
        // arguments defined by service decorators
        const serviceDependencies = _util.getServiceDependencies(ctor).sort((a, b) => a.index - b.index);
        const serviceArgs = [];
        for (const dependency of serviceDependencies) {
            const service = this._getOrCreateServiceInstance(dependency.id, _trace);
            if (!service) {
                this._throwIfStrict(`[createInstance] ${ctor.name} depends on UNKNOWN service ${dependency.id}.`, false);
            }
            serviceArgs.push(service);
        }
        const firstServiceArgPos = serviceDependencies.length > 0 ? serviceDependencies[0].index : args.length;
        // check for argument mismatches, adjust static args if needed
        if (args.length !== firstServiceArgPos) {
            console.trace(`[createInstance] First service dependency of ${ctor.name} at position ${firstServiceArgPos + 1} conflicts with ${args.length} static arguments`);
            const delta = firstServiceArgPos - args.length;
            if (delta > 0) {
                args = args.concat(new Array(delta));
            }
            else {
                args = args.slice(0, firstServiceArgPos);
            }
        }
        // now create the instance
        return Reflect.construct(ctor, args.concat(serviceArgs));
    }
    _setCreatedServiceInstance(id, instance) {
        if (this._services.get(id) instanceof SyncDescriptor) {
            this._services.set(id, instance);
        }
        else if (this._parent) {
            this._parent._setCreatedServiceInstance(id, instance);
        }
        else {
            throw new Error('illegalState - setting UNKNOWN service instance');
        }
    }
    _getServiceInstanceOrDescriptor(id) {
        const instanceOrDesc = this._services.get(id);
        if (!instanceOrDesc && this._parent) {
            return this._parent._getServiceInstanceOrDescriptor(id);
        }
        else {
            return instanceOrDesc;
        }
    }
    _getOrCreateServiceInstance(id, _trace) {
        if (this._globalGraph && this._globalGraphImplicitDependency) {
            this._globalGraph.insertEdge(this._globalGraphImplicitDependency, String(id));
        }
        const thing = this._getServiceInstanceOrDescriptor(id);
        if (thing instanceof SyncDescriptor) {
            return this._safeCreateAndCacheServiceInstance(id, thing, _trace.branch(id, true));
        }
        else {
            _trace.branch(id, false);
            return thing;
        }
    }
    _safeCreateAndCacheServiceInstance(id, desc, _trace) {
        if (this._activeInstantiations.has(id)) {
            throw new Error(`illegal state - RECURSIVELY instantiating service '${id}'`);
        }
        this._activeInstantiations.add(id);
        try {
            return this._createAndCacheServiceInstance(id, desc, _trace);
        }
        finally {
            this._activeInstantiations.delete(id);
        }
    }
    _createAndCacheServiceInstance(id, desc, _trace) {
        const graph = new Graph(data => data.id.toString());
        let cycleCount = 0;
        const stack = [{ id, desc, _trace }];
        const seen = new Set();
        while (stack.length) {
            const item = stack.pop();
            if (seen.has(String(item.id))) {
                continue;
            }
            seen.add(String(item.id));
            graph.lookupOrInsertNode(item);
            // a weak but working heuristic for cycle checks
            if (cycleCount++ > 1000) {
                throw new CyclicDependencyError(graph);
            }
            // check all dependencies for existence and if they need to be created first
            for (const dependency of _util.getServiceDependencies(item.desc.ctor)) {
                const instanceOrDesc = this._getServiceInstanceOrDescriptor(dependency.id);
                if (!instanceOrDesc) {
                    this._throwIfStrict(`[createInstance] ${id} depends on ${dependency.id} which is NOT registered.`, true);
                }
                // take note of all service dependencies
                this._globalGraph?.insertEdge(String(item.id), String(dependency.id));
                if (instanceOrDesc instanceof SyncDescriptor) {
                    const d = { id: dependency.id, desc: instanceOrDesc, _trace: item._trace.branch(dependency.id, true) };
                    graph.insertEdge(item, d);
                    stack.push(d);
                }
            }
        }
        while (true) {
            const roots = graph.roots();
            // if there is no more roots but still
            // nodes in the graph we have a cycle
            if (roots.length === 0) {
                if (!graph.isEmpty()) {
                    throw new CyclicDependencyError(graph);
                }
                break;
            }
            for (const { data } of roots) {
                // Repeat the check for this still being a service sync descriptor. That's because
                // instantiating a dependency might have side-effect and recursively trigger instantiation
                // so that some dependencies are now fullfilled already.
                const instanceOrDesc = this._getServiceInstanceOrDescriptor(data.id);
                if (instanceOrDesc instanceof SyncDescriptor) {
                    // create instance and overwrite the service collections
                    const instance = this._createServiceInstanceWithOwner(data.id, data.desc.ctor, data.desc.staticArguments, data.desc.supportsDelayedInstantiation, data._trace);
                    this._setCreatedServiceInstance(data.id, instance);
                }
                graph.removeNode(data);
            }
        }
        return this._getServiceInstanceOrDescriptor(id);
    }
    _createServiceInstanceWithOwner(id, ctor, args = [], supportsDelayedInstantiation, _trace) {
        if (this._services.get(id) instanceof SyncDescriptor) {
            return this._createServiceInstance(id, ctor, args, supportsDelayedInstantiation, _trace, this._servicesToMaybeDispose);
        }
        else if (this._parent) {
            return this._parent._createServiceInstanceWithOwner(id, ctor, args, supportsDelayedInstantiation, _trace);
        }
        else {
            throw new Error(`illegalState - creating UNKNOWN service instance ${ctor.name}`);
        }
    }
    _createServiceInstance(id, ctor, args = [], supportsDelayedInstantiation, _trace, disposeBucket) {
        if (!supportsDelayedInstantiation) {
            // eager instantiation
            const result = this._createInstance(ctor, args, _trace);
            disposeBucket.add(result);
            return result;
        }
        else {
            const child = new InstantiationService(undefined, this._strict, this, this._enableTracing);
            child._globalGraphImplicitDependency = String(id);
            // Return a proxy object that's backed by an idle value. That
            // strategy is to instantiate services in our idle time or when actually
            // needed but not when injected into a consumer
            // return "empty events" when the service isn't instantiated yet
            const earlyListeners = new Map();
            const idle = new GlobalIdleValue(() => {
                const result = child._createInstance(ctor, args, _trace);
                // early listeners that we kept are now being subscribed to
                // the real service
                for (const [key, values] of earlyListeners) {
                    // eslint-disable-next-line local/code-no-any-casts
                    const candidate = result[key];
                    if (typeof candidate === 'function') {
                        for (const value of values) {
                            value.disposable = candidate.apply(result, value.listener);
                        }
                    }
                }
                earlyListeners.clear();
                disposeBucket.add(result);
                return result;
            });
            return new Proxy(Object.create(null), {
                get(target, key) {
                    if (!idle.isInitialized) {
                        // looks like an event
                        if (typeof key === 'string' && (key.startsWith('onDid') || key.startsWith('onWill'))) {
                            let list = earlyListeners.get(key);
                            if (!list) {
                                list = new LinkedList();
                                earlyListeners.set(key, list);
                            }
                            const event = (callback, thisArg, disposables) => {
                                if (idle.isInitialized) {
                                    return idle.value[key](callback, thisArg, disposables);
                                }
                                else {
                                    const entry = { listener: [callback, thisArg, disposables], disposable: undefined };
                                    const rm = list.push(entry);
                                    const result = toDisposable(() => {
                                        rm();
                                        entry.disposable?.dispose();
                                    });
                                    return result;
                                }
                            };
                            return event;
                        }
                    }
                    // value already exists
                    if (key in target) {
                        return target[key];
                    }
                    // create value
                    const obj = idle.value;
                    let prop = obj[key];
                    if (typeof prop !== 'function') {
                        return prop;
                    }
                    prop = prop.bind(obj);
                    target[key] = prop;
                    return prop;
                },
                set(_target, p, value) {
                    idle.value[p] = value;
                    return true;
                },
                getPrototypeOf(_target) {
                    return ctor.prototype;
                }
            });
        }
    }
    _throwIfStrict(msg, printWarning) {
        if (printWarning) {
            console.warn(msg);
        }
        if (this._strict) {
            throw new Error(msg);
        }
    }
}
//#region -- tracing ---
var TraceType;
(function (TraceType) {
    TraceType[TraceType["None"] = 0] = "None";
    TraceType[TraceType["Creation"] = 1] = "Creation";
    TraceType[TraceType["Invocation"] = 2] = "Invocation";
    TraceType[TraceType["Branch"] = 3] = "Branch";
})(TraceType || (TraceType = {}));
export class Trace {
    static { this.all = new Set(); }
    static { this._None = new class extends Trace {
        constructor() { super(0 /* TraceType.None */, null); }
        stop() { }
        branch() { return this; }
    }; }
    static traceInvocation(_enableTracing, ctor) {
        return !_enableTracing ? Trace._None : new Trace(2 /* TraceType.Invocation */, ctor.name || new Error().stack.split('\n').slice(3, 4).join('\n'));
    }
    static traceCreation(_enableTracing, ctor) {
        return !_enableTracing ? Trace._None : new Trace(1 /* TraceType.Creation */, ctor.name);
    }
    static { this._totals = 0; }
    constructor(type, name) {
        this.type = type;
        this.name = name;
        this._start = Date.now();
        this._dep = [];
    }
    branch(id, first) {
        const child = new Trace(3 /* TraceType.Branch */, id.toString());
        this._dep.push([id, first, child]);
        return child;
    }
    stop() {
        const dur = Date.now() - this._start;
        Trace._totals += dur;
        let causedCreation = false;
        function printChild(n, trace) {
            const res = [];
            const prefix = new Array(n + 1).join('\t');
            for (const [id, first, child] of trace._dep) {
                if (first && child) {
                    causedCreation = true;
                    res.push(`${prefix}CREATES -> ${id}`);
                    const nested = printChild(n + 1, child);
                    if (nested) {
                        res.push(nested);
                    }
                }
                else {
                    res.push(`${prefix}uses -> ${id}`);
                }
            }
            return res.join('\n');
        }
        const lines = [
            `${this.type === 1 /* TraceType.Creation */ ? 'CREATE' : 'CALL'} ${this.name}`,
            `${printChild(1, this)}`,
            `DONE, took ${dur.toFixed(2)}ms (grand total ${Trace._totals.toFixed(2)}ms)`
        ];
        if (dur > 2 || causedCreation) {
            Trace.all.add(lines.join('\n'));
        }
    }
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFudGlhdGlvblNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRWhFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM5RCxPQUFPLEVBQW1CLE9BQU8sRUFBZSxZQUFZLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEgsT0FBTyxFQUFFLGNBQWMsRUFBbUIsTUFBTSxrQkFBa0IsQ0FBQztBQUNuRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBNEIscUJBQXFCLEVBQXVDLEtBQUssRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ2pJLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzNELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUVoRSxVQUFVO0FBQ1YsTUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBRTdCO0FBRUYsTUFBTSxxQkFBc0IsU0FBUSxLQUFLO0lBQ3hDLFlBQVksS0FBaUI7UUFDNUIsS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7UUFDNUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsYUFBYSxFQUFFLElBQUksNENBQTRDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO0lBQ3hHLENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxvQkFBb0I7SUFXaEMsWUFDa0IsWUFBK0IsSUFBSSxpQkFBaUIsRUFBRSxFQUN0RCxVQUFtQixLQUFLLEVBQ3hCLE9BQThCLEVBQzlCLGlC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