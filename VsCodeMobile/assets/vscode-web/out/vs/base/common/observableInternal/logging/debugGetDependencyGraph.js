/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Derived } from '../observables/derivedImpl.js';
import { FromEventObservable } from '../observables/observableFromEvent.js';
import { ObservableValue } from '../observables/observableValue.js';
import { AutorunObserver } from '../reactions/autorunImpl.js';
import { formatValue } from './consoleObservableLogger.js';
export function debugGetObservableGraph(obs, options) {
    const debugNamePostProcessor = options?.debugNamePostProcessor ?? ((str) => str);
    const info = Info.from(obs, debugNamePostProcessor);
    if (!info) {
        return '';
    }
    const alreadyListed = new Set();
    if (options.type === 'observers') {
        return formatObservableInfoWithObservers(info, 0, alreadyListed, options).trim();
    }
    else {
        return formatObservableInfoWithDependencies(info, 0, alreadyListed, options).trim();
    }
}
function formatObservableInfoWithDependencies(info, indentLevel, alreadyListed, options) {
    const indent = '\t\t'.repeat(indentLevel);
    const lines = [];
    const isAlreadyListed = alreadyListed.has(info.sourceObj);
    if (isAlreadyListed) {
        lines.push(`${indent}* ${info.type} ${info.name} (already listed)`);
        return lines.join('\n');
    }
    alreadyListed.add(info.sourceObj);
    lines.push(`${indent}* ${info.type} ${info.name}:`);
    lines.push(`${indent}  value: ${formatValue(info.value, 50)}`);
    lines.push(`${indent}  state: ${info.state}`);
    if (info.dependencies.length > 0) {
        lines.push(`${indent}  dependencies:`);
        for (const dep of info.dependencies) {
            const info = Info.from(dep, options.debugNamePostProcessor ?? (name => name)) ?? Info.unknown(dep);
            lines.push(formatObservableInfoWithDependencies(info, indentLevel + 1, alreadyListed, options));
        }
    }
    return lines.join('\n');
}
function formatObservableInfoWithObservers(info, indentLevel, alreadyListed, options) {
    const indent = '\t\t'.repeat(indentLevel);
    const lines = [];
    const isAlreadyListed = alreadyListed.has(info.sourceObj);
    if (isAlreadyListed) {
        lines.push(`${indent}* ${info.type} ${info.name} (already listed)`);
        return lines.join('\n');
    }
    alreadyListed.add(info.sourceObj);
    lines.push(`${indent}* ${info.type} ${info.name}:`);
    lines.push(`${indent}  value: ${formatValue(info.value, 50)}`);
    lines.push(`${indent}  state: ${info.state}`);
    if (info.observers.length > 0) {
        lines.push(`${indent}  observers:`);
        for (const observer of info.observers) {
            const info = Info.from(observer, options.debugNamePostProcessor ?? (name => name)) ?? Info.unknown(observer);
            lines.push(formatObservableInfoWithObservers(info, indentLevel + 1, alreadyListed, options));
        }
    }
    return lines.join('\n');
}
class Info {
    static from(obs, debugNamePostProcessor) {
        if (obs instanceof AutorunObserver) {
            const state = obs.debugGetState();
            return new Info(obs, debugNamePostProcessor(obs.debugName), 'autorun', undefined, state.stateStr, Array.from(state.dependencies), []);
        }
        else if (obs instanceof Derived) {
            const state = obs.debugGetState();
            return new Info(obs, debugNamePostProcessor(obs.debugName), 'derived', state.value, state.stateStr, Array.from(state.dependencies), Array.from(obs.debugGetObservers()));
        }
        else if (obs instanceof ObservableValue) {
            const state = obs.debugGetState();
            return new Info(obs, debugNamePostProcessor(obs.debugName), 'observableValue', state.value, 'upToDate', [], Array.from(obs.debugGetObservers()));
        }
        else if (obs instanceof FromEventObservable) {
            const state = obs.debugGetState();
            return new Info(obs, debugNamePostProcessor(obs.debugName), 'fromEvent', state.value, state.hasValue ? 'upToDate' : 'initial', [], Array.from(obs.debugGetObservers()));
        }
        return undefined;
    }
    static unknown(obs) {
        return new Info(obs, '(unknown)', 'unknown', undefined, 'unknown', [], []);
    }
    constructor(sourceObj, name, type, value, state, dependencies, observers) {
        this.sourceObj = sourceObj;
        this.name = name;
        this.type = type;
        this.value = value;
        this.state = state;
        this.dependencies = dependencies;
        this.observers = observers;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdHZXREZXBlbmRlbmN5R3JhcGguanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2JzZXJ2YWJsZUludGVybmFsL2xvZ2dpbmcvZGVidWdHZXREZXBlbmRlbmN5R3JhcGgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDOUQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBTzNELE1BQU0sVUFBVSx1QkFBdUIsQ0FBQyxHQUFpQyxFQUFFLE9BQWlCO0lBQzNGLE1BQU0sc0JBQXNCLEdBQUcsT0FBTyxFQUFFLHNCQUFzQixJQUFJLENBQUMsQ0FBQyxHQUFXLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pGLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLHNCQUFzQixDQUFDLENBQUM7SUFDcEQsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1gsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQWdDLENBQUM7SUFFOUQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRSxDQUFDO1FBQ2xDLE9BQU8saUNBQWlDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDbEYsQ0FBQztTQUFNLENBQUM7UUFDUCxPQUFPLG9D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