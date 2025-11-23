/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { findLast } from '../../../../base/common/arraysFind.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, autorunHandleChanges, autorunOpts, autorunWithStore, observableValue, transaction } from '../../../../base/common/observable.js';
import { ElementSizeObserver } from '../../config/elementSizeObserver.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { TextLength } from '../../../common/core/text/textLength.js';
export function joinCombine(arr1, arr2, keySelector, combine) {
    if (arr1.length === 0) {
        return arr2;
    }
    if (arr2.length === 0) {
        return arr1;
    }
    const result = [];
    let i = 0;
    let j = 0;
    while (i < arr1.length && j < arr2.length) {
        const val1 = arr1[i];
        const val2 = arr2[j];
        const key1 = keySelector(val1);
        const key2 = keySelector(val2);
        if (key1 < key2) {
            result.push(val1);
            i++;
        }
        else if (key1 > key2) {
            result.push(val2);
            j++;
        }
        else {
            result.push(combine(val1, val2));
            i++;
            j++;
        }
    }
    while (i < arr1.length) {
        result.push(arr1[i]);
        i++;
    }
    while (j < arr2.length) {
        result.push(arr2[j]);
        j++;
    }
    return result;
}
// TODO make utility
export function applyObservableDecorations(editor, decorations) {
    const d = new DisposableStore();
    const decorationsCollection = editor.createDecorationsCollection();
    d.add(autorunOpts({ debugName: () => `Apply decorations from ${decorations.debugName}` }, reader => {
        const d = decorations.read(reader);
        decorationsCollection.set(d);
    }));
    d.add({
        dispose: () => {
            decorationsCollection.clear();
        }
    });
    return d;
}
export function appendRemoveOnDispose(parent, child) {
    parent.appendChild(child);
    return toDisposable(() => {
        child.remove();
    });
}
export function prependRemoveOnDispose(parent, child) {
    parent.prepend(child);
    return toDisposable(() => {
        child.remove();
    });
}
export class ObservableElementSizeObserver extends Disposable {
    get width() { return this._width; }
    get height() { return this._height; }
    get automaticLayout() { return this._automaticLayout; }
    constructor(element, dimension) {
        super();
        this._automaticLayout = false;
        this.elementSizeObserver = this._register(new ElementSizeObserver(element, dimension));
        this._width = observableValue(this, this.elementSizeObserver.getWidth());
        this._height = observableValue(this, this.elementSizeObserver.getHeight());
        this._register(this.elementSizeObserver.onDidChange(e => transaction(tx => {
            /** @description Set width/height from elementSizeObserver */
            this._width.set(this.elementSizeObserver.getWidth(), tx);
            this._height.set(this.elementSizeObserver.getHeight(), tx);
        })));
    }
    observe(dimension) {
        this.elementSizeObserver.observe(dimension);
    }
    setAutomaticLayout(automaticLayout) {
        this._automaticLayout = automaticLayout;
        if (automaticLayout) {
            this.elementSizeObserver.startObserving();
        }
        else {
            this.elementSizeObserver.stopObserving();
        }
    }
}
export function animatedObservable(targetWindow, base, store) {
    let targetVal = base.get();
    let startVal = targetVal;
    let curVal = targetVal;
    const result = observableValue('animatedValue', targetVal);
    let animationStartMs = -1;
    const durationMs = 300;
    let animationFrame = undefined;
    store.add(autorunHandleChanges({
        changeTracker: {
            createChangeSummary: () => ({ animate: false }),
            handleChange: (ctx, s) => {
                if (ctx.didChange(base)) {
                    s.animate = s.animate || ctx.change;
                }
                return true;
            }
        }
    }, (reader, s) => {
        /** @description update value */
        if (animationFrame !== undefined) {
            targetWindow.cancelAnimationFrame(animationFrame);
            animationFrame = undefined;
        }
        startVal = curVal;
        targetVal = base.read(reader);
        animationStartMs = Date.now() - (s.animate ? 0 : durationMs);
        update();
    }));
    function update() {
        const passedMs = Date.now() - animationStartMs;
        curVal = Math.floor(easeOutExpo(passedMs, startVal, targetVal - startVal, durationMs));
        if (passedMs < durationMs) {
            animationFrame = targetWindow.requestAnimationFrame(update);
        }
        else {
            curVal = targetVal;
        }
        result.set(curVal, undefined);
    }
    return result;
}
function easeOutExpo(t, b, c, d) {
    return t === d ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
}
export function deepMerge(source1, source2) {
    // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
    const result = {};
    for (const key in source1) {
        result[key] = source1[key];
    }
    for (const key in source2) {
        const source2Value = source2[key];
        if (typeof result[key] === 'object' && source2Value && typeof source2Value === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result[key] = deepMerge(result[key], source2Value);
        }
        else {
            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
            result[key] = source2Value;
        }
    }
    return result;
}
export class ViewZoneOverlayWidget extends Disposable {
    constructor(editor, viewZone, htmlElement) {
        super();
        this._register(new ManagedOverlayWidget(editor, htmlElement));
        this._register(applyStyle(htmlElement, {
            height: viewZone.actualHeight,
            top: viewZone.actualTop,
        }));
    }
}
export class PlaceholderViewZone {
    get afterLineNumber() { return this._afterLineNumber.get(); }
    constructor(_afterLineNumber, heightInPx) {
        this._afterLineNumber = _afterLineNumber;
        this.heightInPx = heightInPx;
        this.domNode = document.createElement('div');
        this._actualTop = observableValue(this, undefined);
        this._actualHeight = observableValue(this, undefined);
        this.actualTop = this._actualTop;
        this.actualHeight = this._actualHeight;
        this.showInHiddenAreas = true;
        this.onChange = this._afterLineNumber;
        this.onDomNodeTop = (top) => {
            this._actualTop.set(top, undefined);
        };
        this.onComputedHeight = (height) => {
            this._actualHeight.set(height, undefined);
        };
    }
}
export class ManagedOverlayWidget {
    static { this._counter = 0; }
    constructor(_editor, _domElement) {
        this._editor = _editor;
        this._domElement = _domElement;
        this._overlayWidgetId = `managedOverlayWidget-${ManagedOverlayWidget._counter++}`;
        this._overlayWidget = {
            getId: () => this._overlayWidgetId,
            getDomNode: () => this._domElement,
            getPosition: () => null
        };
        this._editor.addOverlayWidget(this._overlayWidget);
    }
    dispose() {
        this._editor.removeOverlayWidget(this._overlayWidget);
    }
}
export function applyStyle(domNode, style) {
    return autorun(reader => {
        /** @description applyStyle */
        for (let [key, val] of Object.entries(style)) {
            if (val && typeof val === 'object' && 'read' in val) {
                // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
                val = val.read(reader);
            }
            if (typeof val === 'number') {
                val = `${val}px`;
            }
            key = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
            domNode.style[key] = val;
        }
    });
}
export function applyViewZones(editor, viewZones, setIsUpdating, zoneIds) {
    const store = new DisposableStore();
    const lastViewZoneIds = [];
    store.add(autorunWithStore((reader, store) => {
        /** @description applyViewZones */
        const curViewZones = viewZones.read(reader);
        const viewZonIdsPerViewZone = new Map();
        const viewZoneIdPerOnChangeObservable = new Map();
        // Add/remove view zones
        if (setIsUpdating) {
            setIsUpdating(true);
        }
        editor.changeViewZones(a => {
            for (const id of lastViewZoneIds) {
                a.removeZone(id);
                zoneIds?.delete(id);
            }
            lastViewZoneIds.length = 0;
            for (const z of curViewZones) {
                const id = a.addZone(z);
                if (z.setZoneId) {
                    z.setZoneId(id);
                }
                lastViewZoneIds.push(id);
                zoneIds?.add(id);
                viewZonIdsPerViewZone.set(z, id);
            }
        });
        if (setIsUpdating) {
            setIsUpdating(false);
        }
        // Layout zone on change
        store.add(autorunHandleChanges({
            changeTracker: {
                createChangeSummary() {
                    return { zoneIds: [] };
                },
                handleChange(context, changeSummary) {
                    const id = viewZoneIdPerOnChangeObservable.get(context.changedObservable);
                    if (id !== undefined) {
                        changeSummary.zoneIds.push(id);
                    }
                    return true;
                },
            }
        }, (reader, changeSummary) => {
            /** @description layoutZone on change */
            for (const vz of curViewZones) {
                if (vz.onChange) {
                    viewZoneIdPerOnChangeObservable.set(vz.onChange, viewZonIdsPerViewZone.get(vz));
                    vz.onChange.read(reader);
                }
            }
            if (setIsUpdating) {
                setIsUpdating(true);
            }
            editor.changeViewZones(a => { for (const id of changeSummary.zoneIds) {
                a.layoutZone(id);
            } });
            if (setIsUpdating) {
                setIsUpdating(false);
            }
        }));
    }));
    store.add({
        dispose() {
            if (setIsUpdating) {
                setIsUpdating(true);
            }
            editor.changeViewZones(a => { for (const id of lastViewZoneIds) {
                a.removeZone(id);
            } });
            zoneIds?.clear();
            if (setIsUpdating) {
                setIsUpdating(false);
            }
        }
    });
    return store;
}
export class DisposableCancellationTokenSource extends CancellationTokenSource {
    dispose() {
        super.dispose(true);
    }
}
export function translatePosition(posInOriginal, mappings) {
    const mapping = findLast(mappings, m => m.original.startLineNumber <= posInOriginal.lineNumber);
    if (!mapping) {
        // No changes before the position
        return Range.fromPositions(posInOriginal);
    }
    if (mapping.original.endLineNumberExclusive <= posInOriginal.lineNumber) {
        const newLineNumber = posInOriginal.lineNumber - mapping.original.endLineNumberExclusive + mapping.modified.endLineNumberExclusive;
        return Range.fromPositions(new Position(newLineNumber, posInOriginal.column));
    }
    if (!mapping.innerChanges) {
        // Only for legacy algorithm
        return Range.fromPositions(new Position(mapping.modified.startLineNumber, 1));
    }
    const innerMapping = findLast(mapping.innerChanges, m => m.originalRange.getStartPosition().isBeforeOrEqual(posInOriginal));
    if (!innerMapping) {
        const newLineNumber = posInOriginal.lineNumber - mapping.original.startLineNumber + mapping.modified.startLineNumber;
        return Range.fromPositions(new Position(newLineNumber, posInOriginal.column));
    }
    if (innerMapping.originalRange.containsPosition(posInOriginal)) {
        return innerMapping.modifiedRange;
    }
    else {
        const l = lengthBetweenPositions(innerMapping.originalRange.getEndPosition(), posInOriginal);
        return Range.fromPositions(l.addToPosition(innerMapping.modifiedRange.getEndPosition()));
    }
}
function lengthBetweenPositions(position1, position2) {
    if (position1.lineNumber === position2.lineNumber) {
        return new TextLength(0, position2.column - position1.column);
    }
    else {
        return new TextLength(position2.lineNumber - position1.lineNumber, position2.column - 1);
    }
}
export function filterWithPrevious(arr, filter) {
    let prev;
    return arr.filter(cur => {
        const result = filter(cur, prev);
        prev = cur;
        return result;
    });
}
export class RefCounted {
    static create(value, debugOwner = undefined) {
        return new BaseRefCounted(value, value, debugOwner);
    }
    static createWithDisposable(value, disposable, debugOwner = undefined) {
        const store = new DisposableStore();
        store.add(disposable);
        store.add(value);
        return new BaseRefCounted(value, store, debugOwner);
    }
    static createOfNonDisposable(value, disposable, debugOwner = undefined) {
        return new BaseRefCounted(value, disposable, debugOwner);
    }
}
class BaseRefCounted extends RefCounted {
    constructor(object, _disposable, _debugOwner) {
        super();
        this.object = object;
        this._disposable = _disposable;
        this._debugOwner = _debugOwner;
        this._refCount = 1;
        this._isDisposed = false;
        this._owners = [];
        if (_debugOwner) {
            this._addOwner(_debugOwner);
        }
    }
    _addOwner(debugOwner) {
        if (debugOwner) {
            this._owners.push(debugOwner);
        }
    }
    createNewRef(debugOwner) {
        this._refCount++;
        if (debugOwner) {
            this._addOwner(debugOwner);
        }
        return new ClonedRefCounted(this, debugOwner);
    }
    dispose() {
        if (this._isDisposed) {
            return;
        }
        this._isDisposed = true;
        this._decreaseRefCount(this._debugOwner);
    }
    _decreaseRefCount(debugOwner) {
        this._refCount--;
        if (this._refCount === 0) {
            this._disposable.dispose();
        }
        if (debugOwner) {
            const idx = this._owners.indexOf(debugOwner);
            if (idx !== -1) {
                this._owners.splice(idx, 1);
            }
        }
    }
}
class ClonedRefCounted extends RefCounted {
    constructor(_base, _debugOwner) {
        super();
        this._base = _base;
        this._debugOwner = _debugOwner;
        this._isDisposed = false;
    }
    get object() { return this._base.object; }
    createNewRef(debugOwner) {
        return this._base.createNewRef(debugOwner);
    }
    dispose() {
        if (this._isDisposed) {
            return;
        }
        this._isDisposed = true;
        this._base._decreaseRefCount(this._debugOwner);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUEyQixZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMxSCxPQUFPLEVBQTJELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzVNLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFHdEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXJFLE1BQU0sVUFBVSxXQUFXLENBQUksSUFBa0IsRUFBRSxJQUFrQixFQUFFLFdBQStCLEVBQUUsT0FBNEI7SUFDbkksSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUNELElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN2QixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxNQUFNLE1BQU0sR0FBUSxFQUFFLENBQUM7SUFDdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ1YsSUFBSSxDQUFDLEdBQUcsQ0FB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