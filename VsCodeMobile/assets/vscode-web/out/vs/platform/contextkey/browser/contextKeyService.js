/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Event, PauseableEmitter } from '../../../base/common/event.js';
import { Iterable } from '../../../base/common/iterator.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../base/common/lifecycle.js';
import { cloneAndChange, distinct, equals } from '../../../base/common/objects.js';
import { TernarySearchTree } from '../../../base/common/ternarySearchTree.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { CommandsRegistry } from '../../commands/common/commands.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IContextKeyService, RawContextKey } from '../common/contextkey.js';
import { InputFocusedContext } from '../common/contextkeys.js';
import { mainWindow } from '../../../base/browser/window.js';
import { addDisposableListener, EventType, getActiveWindow, isEditableElement, onDidRegisterWindow, trackFocus } from '../../../base/browser/dom.js';
const KEYBINDING_CONTEXT_ATTR = 'data-keybinding-context';
export class Context {
    constructor(id, parent) {
        this._id = id;
        this._parent = parent;
        this._value = Object.create(null);
        this._value['_contextId'] = id;
    }
    get value() {
        return { ...this._value };
    }
    setValue(key, value) {
        // console.log('SET ' + key + ' = ' + value + ' ON ' + this._id);
        if (!equals(this._value[key], value)) {
            this._value[key] = value;
            return true;
        }
        return false;
    }
    removeValue(key) {
        // console.log('REMOVE ' + key + ' FROM ' + this._id);
        if (key in this._value) {
            delete this._value[key];
            return true;
        }
        return false;
    }
    getValue(key) {
        const ret = this._value[key];
        if (typeof ret === 'undefined' && this._parent) {
            return this._parent.getValue(key);
        }
        return ret;
    }
    updateParent(parent) {
        this._parent = parent;
    }
    collectAllValues() {
        let result = this._parent ? this._parent.collectAllValues() : Object.create(null);
        result = { ...result, ...this._value };
        delete result['_contextId'];
        return result;
    }
}
class NullContext extends Context {
    static { this.INSTANCE = new NullContext(); }
    constructor() {
        super(-1, null);
    }
    setValue(key, value) {
        return false;
    }
    removeValue(key) {
        return false;
    }
    getValue(key) {
        return undefined;
    }
    collectAllValues() {
        return Object.create(null);
    }
}
class ConfigAwareContextValuesContainer extends Context {
    static { this._keyPrefix = 'config.'; }
    constructor(id, _configurationService, emitter) {
        super(id, null);
        this._configurationService = _configurationService;
        this._values = TernarySearchTree.forConfigKeys();
        this._listener = this._configurationService.onDidChangeConfiguration(event => {
            if (event.source === 7 /* ConfigurationTarget.DEFAULT */) {
                // new setting, reset everything
                const allKeys = Array.from(this._values, ([k]) => k);
                this._values.clear();
                emitter.fire(new ArrayContextKeyChangeEvent(allKeys));
            }
            else {
                const changedKeys = [];
                for (const configKey of event.affectedKeys) {
                    const contextKey = `config.${configKey}`;
                    const cachedItems = this._values.findSuperstr(contextKey);
                    if (cachedItems !== undefined) {
                        changedKeys.push(...Iterable.map(cachedItems, ([key]) => key));
                        this._values.deleteSuperstr(contextKey);
                    }
                    if (this._values.has(contextKey)) {
                        changedKeys.push(contextKey);
                        this._values.delete(contextKey);
                    }
                }
                emitter.fire(new ArrayContextKeyChangeEvent(changedKeys));
            }
        });
    }
    dispose() {
        this._listener.dispose();
    }
    getValue(key) {
        if (key.indexOf(ConfigAwareContextValuesContainer._keyPrefix) !== 0) {
            return super.getValue(key);
        }
        if (this._values.has(key)) {
            return this._values.get(key);
        }
        const configKey = key.substr(ConfigAwareContextValuesContainer._keyPrefix.length);
        const configValue = this._configurationService.getValue(configKey);
        let value = undefined;
        switch (typeof configValue) {
            case 'number':
            case 'boolean':
            case 'string':
                value = configValue;
                break;
            default:
                if (Array.isArray(configValue)) {
                    value = JSON.stringify(configValue);
                }
                else {
                    value = configValue;
                }
        }
        this._values.set(key, value);
        return value;
    }
    setValue(key, value) {
        return super.setValue(key, value);
    }
    removeValue(key) {
        return super.removeValue(key);
    }
    collectAllValues() {
        const result = Object.create(null);
        this._values.forEach((value, index) => result[index] = value);
        return { ...result, ...super.collectAllValues() };
    }
}
class ContextKey {
    constructor(service, key, defaultValue) {
        this._service = service;
        this._key = key;
        this._defaultValue = defaultValue;
        this.reset();
    }
    set(value) {
        this._service.setContext(this._key, value);
    }
    reset() {
        if (typeof this._defaultValue === 'undefined') {
            this._service.removeContext(this._key);
        }
        else {
            this._service.setContext(this._key, this._defaultValue);
        }
    }
    get() {
        return this._service.getContextKeyValue(this._key);
    }
}
class SimpleContextKeyChangeEvent {
    constructor(key) {
        this.key = key;
    }
    affectsSome(keys) {
        return keys.has(this.key);
    }
    allKeysContainedIn(keys) {
        return this.affectsSome(keys);
    }
}
class ArrayContextKeyChangeEvent {
    constructor(keys) {
        this.keys = keys;
    }
    affectsSome(keys) {
        for (const key of this.keys) {
            if (keys.has(key)) {
                return true;
            }
        }
        return false;
    }
    allKeysContainedIn(keys) {
        return this.keys.every(key => keys.has(key));
    }
}
class CompositeContextKeyChangeEvent {
    constructor(events) {
        this.events = events;
    }
    affectsSome(keys) {
        for (const e of this.events) {
            if (e.affectsSome(keys)) {
                return true;
            }
        }
        return false;
    }
    allKeysContainedIn(keys) {
        return this.events.every(evt => evt.allKeysContainedIn(keys));
    }
}
function allEventKeysInContext(event, context) {
    return event.allKeysContainedIn(new Set(Object.keys(context)));
}
export class AbstractContextKeyService extends Disposable {
    get onDidChangeContext() { return this._onDidChangeContext.event; }
    constructor(myContextId) {
        super();
        this._onDidChangeContext = this._register(new PauseableEmitter({ merge: input => new CompositeContextKeyChangeEvent(input) }));
        this._isDisposed = false;
        this._myContextId = myContextId;
    }
    get contextId() {
        return this._myContextId;
    }
    createKey(key, defaultValue) {
        if (this._isDisposed) {
            throw new Error(`AbstractContextKeyService has been disposed`);
        }
        return new ContextKey(this, key, defaultValue);
    }
    bufferChangeEvents(callback) {
        this._onDidChangeContext.pause();
        try {
            callback();
        }
        finally {
            this._onDidChangeContext.resume();
        }
    }
    createScoped(domNode) {
        if (this._isDisposed) {
            throw new Error(`AbstractContextKeyService has been disposed`);
        }
        return new ScopedContextKeyService(this, domNode);
    }
    createOverlay(overlay = Iterable.empty()) {
        if (this._isDisposed) {
            throw new Error(`AbstractContextKeyService has been disposed`);
        }
        return new OverlayContextKeyService(this, overlay);
    }
    contextMatchesRules(rules) {
        if (this._isDisposed) {
            throw new Error(`AbstractContextKeyService has been disposed`);
        }
        const context = this.getContextValuesContainer(this._myContextId);
        const result = (rules ? rules.evaluate(context) : true);
        // console.group(rules.serialize() + ' -> ' + result);
        // rules.keys().forEach(key => { console.log(key, ctx[key]); });
        // console.groupEnd();
        return result;
    }
    getContextKeyValue(key) {
        if (this._isDisposed) {
            return undefined;
        }
        return this.getContextValuesContainer(this._myContextId).getValue(key);
    }
    setContext(key, value) {
        if (this._isDisposed) {
            return;
        }
        const myContext = this.getContextValuesContainer(this._myContextId);
        if (!myContext) {
            return;
        }
        if (myContext.setValue(key, value)) {
            this._onDidChangeContext.fire(new SimpleContextKeyChangeEvent(key));
        }
    }
    removeContext(key) {
        if (this._isDisposed) {
            return;
        }
        if (this.getContextValuesContainer(this._myContextId).removeValue(key)) {
            this._onDidChangeContext.fire(new SimpleContextKeyChangeEvent(key));
        }
    }
    getContext(target) {
        if (this._isDisposed) {
            return NullContext.INSTANCE;
        }
        return this.getContextValuesContainer(findContextAttr(target));
    }
    dispose() {
        super.dispose();
        this._isDisposed = true;
    }
}
let ContextKeyService = class ContextKeyService extends AbstractContextKeyService {
    constructor(configurationService) {
        super(0);
        this._contexts = new Map();
        this._lastContextId = 0;
        this.inputFocusedContext = InputFocusedContext.bindTo(this);
        const myContext = this._register(new ConfigAwareContextValuesContainer(this._myContextId, configurationService, this._onDidChangeContext));
        this._contexts.set(this._myContextId, myContext);
        // Uncomment this to see the contexts continuously logged
        // let lastLoggedValue: string | null = null;
        // setInterval(() => {
        // 	let values = Object.keys(this._contexts).map((key) => this._contexts[key]);
        // 	let logValue = values.map(v => JSON.stringify(v._value, null, '\t')).join('\n');
        // 	if (lastLoggedValue !== logValue) {
        // 		lastLoggedValue = logValue;
        // 		console.log(lastLoggedValue);
        // 	}
        // }, 2000);
        this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
            const onFocusDisposables = disposables.add(new MutableDisposable());
            disposables.add(addDisposableListener(window, EventType.FOCUS_IN, () => {
                onFocusDisposables.value = new DisposableStore();
                this.updateInputContextKeys(window.document, onFocusDisposables.value);
            }, true));
        }, { window: mainWindow, disposables: this._store }));
    }
    updateInputContextKeys(ownerDocument, disposables) {
        function activeElementIsInput() {
            return !!ownerDocument.activeElement && isEditableElement(ownerDocument.activeElement);
        }
        const isInputFocused = activeElementIsInput();
        this.inputFocusedContext.set(isInputFocused);
        if (isInputFocused) {
            const tracker = disposables.add(trackFocus(ownerDocument.activeElement));
            Event.once(tracker.onDidBlur)(() => {
                // Ensure we are only updating the context key if we are
                // still in the same document that we are tracking. This
                // fixes a race condition in multi-window setups where
                // the blur event arrives in the inactive window overwriting
                // the context key of the active window. This is because
                // blur events from the focus tracker are emitted with a
                // timeout of 0.
                if (getActiveWindow().document === ownerDocument) {
                    this.inputFocusedContext.set(activeElementIsInput());
                }
                tracker.dispose();
            }, undefined, disposables);
        }
    }
    getContextValuesContainer(contextId) {
        if (this._isDisposed) {
            return NullContext.INSTANCE;
        }
        return this._contexts.get(contextId) || NullContext.INSTANCE;
    }
    createChildContext(parentContextId = this._myContextId) {
        if (this._isDisposed) {
            throw new Error(`ContextKeyService has been disposed`);
        }
        const id = (++this._lastContextId);
        this._contexts.set(id, new Context(id, this.getContextValuesContainer(parentContextId)));
        return id;
    }
    disposeContext(contextId) {
        if (!this._isDisposed) {
            this._contexts.delete(contextId);
        }
    }
    updateParent(_parentContextKeyService) {
        throw new Error('Cannot update parent of root ContextKeyService');
    }
};
ContextKeyService = __decorate([
    __param(0, IConfigurationService)
], ContextKeyService);
export { ContextKeyService };
class ScopedContextKeyService extends AbstractContextKeyService {
    constructor(parent, domNode) {
        super(parent.createChildContext());
        this._parentChangeListener = this._register(new MutableDisposable());
        this._parent = parent;
        this._updateParentChangeListener();
        this._domNode = domNode;
        if (this._domNode.hasAttribute(KEYBINDING_CONTEXT_ATTR)) {
            let extraInfo = '';
            if (this._domNode.classList) {
                extraInfo = Array.from(this._domNode.classList.values()).join(', ');
            }
            console.error(`Element already has context attribute${extraInfo ? ': ' + extraInfo : ''}`);
        }
        this._domNode.setAttribute(KEYBINDING_CONTEXT_ATTR, String(this._myContextId));
    }
    _updateParentChangeListener() {
        // Forward parent events to this listener. Parent will change.
        this._parentChangeListener.value = this._parent.onDidChangeContext(e => {
            const thisContainer = this._parent.getContextValuesContainer(this._myContextId);
            const thisContextValues = thisContainer.value;
            if (!allEventKeysInContext(e, thisContextValues)) {
                this._onDidChangeContext.fire(e);
            }
        });
    }
    dispose() {
        if (this._isDisposed) {
            return;
        }
        this._parent.disposeContext(this._myContextId);
        this._domNode.removeAttribute(KEYBINDING_CONTEXT_ATTR);
        super.dispose();
    }
    getContextValuesContainer(contextId) {
        if (this._isDisposed) {
            return NullContext.INSTANCE;
        }
        return this._parent.getContextValuesContainer(contextId);
    }
    createChildContext(parentContextId = this._myContextId) {
        if (this._isDisposed) {
            throw new Error(`ScopedContextKeyService has been disposed`);
        }
        return this._parent.createChildContext(parentContextId);
    }
    disposeContext(contextId) {
        if (this._isDisposed) {
            return;
        }
        this._parent.disposeContext(contextId);
    }
    updateParent(parentContextKeyService) {
        if (this._parent === parentContextKeyService) {
            return;
        }
        const thisContainer = this._parent.getContextValuesContainer(this._myContextId);
        const oldAllValues = thisContainer.collectAllValues();
        this._parent = parentContextKeyService;
        this._updateParentChangeListener();
        const newParentContainer = this._parent.getContextValuesContainer(this._parent.contextId);
        thisContainer.updateParent(newParentContainer);
        const newAllValues = thisContainer.collectAllValues();
        const allValuesDiff = {
            ...distinct(oldAllValues, newAllValues),
            ...distinct(newAllValues, oldAllValues)
        };
        const changedKeys = Object.keys(allValuesDiff);
        this._onDidChangeContext.fire(new ArrayContextKeyChangeEvent(changedKeys));
    }
}
class OverlayContext {
    constructor(parent, overlay) {
        this.parent = parent;
        this.overlay = overlay;
    }
    getValue(key) {
        return this.overlay.has(key) ? this.overlay.get(key) : this.parent.getValue(key);
    }
}
class OverlayContextKeyService {
    get contextId() {
        return this.parent.contextId;
    }
    get onDidChangeContext() {
        return this.parent.onDidChangeContext;
    }
    constructor(parent, overlay) {
        this.parent = parent;
        this.overlay = new Map(overlay);
    }
    bufferChangeEvents(callback) {
        this.parent.bufferChangeEvents(callback);
    }
    createKey() {
        throw new Error('Not supported.');
    }
    getContext(target) {
        return new OverlayContext(this.parent.getContext(target), this.overlay);
    }
    getContextValuesContainer(contextId) {
        const parentContext = this.parent.getContextValuesContainer(contextId);
        return new OverlayContext(parentContext, this.overlay);
    }
    contextMatchesRules(rules) {
        const context = this.getContextValuesContainer(this.contextId);
        const result = (rules ? rules.evaluate(context) : true);
        return result;
    }
    getContextKeyValue(key) {
        return this.overlay.has(key) ? this.overlay.get(key) : this.parent.getContextKeyValue(key);
    }
    createScoped() {
        throw new Error('Not supported.');
    }
    createOverlay(overlay = Iterable.empty()) {
        return new OverlayContextKeyService(this, overlay);
    }
    updateParent() {
        throw new Error('Not supported.');
    }
}
function findContextAttr(domNode) {
    while (domNode) {
        if (domNode.hasAttribute(KEYBINDING_CONTEXT_ATTR)) {
            const attr = domNode.getAttribute(KEYBINDING_CONTEXT_ATTR);
            if (attr) {
                return parseInt(attr, 10);
            }
            return NaN;
        }
        domNode = domNode.parentElement;
    }
    return 0;
}
export function setContext(accessor, contextKey, contextValue) {
    const contextKeyService = accessor.get(IContextKeyService);
    contextKeyService.createKey(String(contextKey), stringifyURIs(contextValue));
}
function stringifyURIs(contextValue) {
    return cloneAndChange(contextValue, (obj) => {
        if (typeof obj === 'object' && obj.$mid === 1 /* MarshalledId.Uri */) {
            return URI.revive(obj).toString();
        }
        if (obj instanceof URI) {
            return obj.toString();
        }
        return undefined;
    });
}
CommandsRegistry.registerCommand('_setContext', setContext);
CommandsRegistry.registerCommand({
    id: 'getContextKeyInfo',
    handler() {
        return [...RawContextKey.all()].sort((a, b) => a.key.localeCompare(b.key));
    },
    metadata: {
        description: localize('getContextKeyInfo', "A command that returns information about context keys"),
        args: []
    }
});
CommandsRegistry.registerCommand('_generateContextKeyInfo', function () {
    const result = [];
    const seen = new Set();
    for (const info of RawContextKey.all()) {
        if (!seen.has(info.key)) {
            seen.add(info.key);
            result.push(info);
        }
    }
    result.sort((a, b) => a.key.localeCompare(b.key));
    console.log(JSON.stringify(result, undefined, 2));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dEtleVNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vY29udGV4dGtleS9icm93c2VyL2NvbnRleHRLZXlTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBVyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNqRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUdoSCxPQUFPLEVBQUUsY0FBYyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNuRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3JFLE9BQU8sRUFBdUIscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN6RyxPQUFPLEVBQXdHLGtCQUFrQixFQUFvRSxhQUFhLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUVwUCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDN0QsT0FBTyxFQUFFLHFCQUFxQixFQUFFLFNBQVMsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsbUJBQW1CLEVBQUUsVUFBVSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFFckos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