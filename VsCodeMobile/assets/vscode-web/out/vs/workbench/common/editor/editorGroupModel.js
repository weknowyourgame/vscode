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
var EditorGroupModel_1;
import { Event, Emitter } from '../../../base/common/event.js';
import { EditorExtensions, SideBySideEditor, EditorCloseContext } from '../editor.js';
import { EditorInput } from './editorInput.js';
import { SideBySideEditorInput } from './sideBySideEditorInput.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { dispose, Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { coalesce } from '../../../base/common/arrays.js';
const EditorOpenPositioning = {
    LEFT: 'left',
    RIGHT: 'right',
    FIRST: 'first',
    LAST: 'last'
};
export function isSerializedEditorGroupModel(group) {
    const candidate = group;
    return !!(candidate && typeof candidate === 'object' && Array.isArray(candidate.editors) && Array.isArray(candidate.mru));
}
export function isGroupEditorChangeEvent(e) {
    const candidate = e;
    return candidate.editor && candidate.editorIndex !== undefined;
}
export function isGroupEditorOpenEvent(e) {
    const candidate = e;
    return candidate.kind === 5 /* GroupModelChangeKind.EDITOR_OPEN */ && candidate.editorIndex !== undefined;
}
export function isGroupEditorMoveEvent(e) {
    const candidate = e;
    return candidate.kind === 7 /* GroupModelChangeKind.EDITOR_MOVE */ && candidate.editorIndex !== undefined && candidate.oldEditorIndex !== undefined;
}
export function isGroupEditorCloseEvent(e) {
    const candidate = e;
    return candidate.kind === 6 /* GroupModelChangeKind.EDITOR_CLOSE */ && candidate.editorIndex !== undefined && candidate.context !== undefined && candidate.sticky !== undefined;
}
let EditorGroupModel = class EditorGroupModel extends Disposable {
    static { EditorGroupModel_1 = this; }
    static { this.IDS = 0; }
    get id() { return this._id; }
    get active() {
        return this.selection[0] ?? null;
    }
    constructor(labelOrSerializedGroup, instantiationService, configurationService) {
        super();
        this.instantiationService = instantiationService;
        this.configurationService = configurationService;
        //#region events
        this._onDidModelChange = this._register(new Emitter({ leakWarningThreshold: 500 /* increased for users with hundreds of inputs opened */ }));
        this.onDidModelChange = this._onDidModelChange.event;
        this.editors = [];
        this.mru = [];
        this.editorListeners = new Set();
        this.locked = false;
        this.selection = []; // editors in selected state, first one is active
        this.preview = null; // editor in preview state
        this.sticky = -1; // index of first editor in sticky state
        this.transient = new Set(); // editors in transient state
        if (isSerializedEditorGroupModel(labelOrSerializedGroup)) {
            this._id = this.deserialize(labelOrSerializedGroup);
        }
        else {
            this._id = EditorGroupModel_1.IDS++;
        }
        this.onConfigurationUpdated();
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationUpdated(e)));
    }
    onConfigurationUpdated(e) {
        if (e && !e.affectsConfiguration('workbench.editor.openPositioning') && !e.affectsConfiguration('workbench.editor.focusRecentEditorAfterClose')) {
            return;
        }
        this.editorOpenPositioning = this.configurationService.getValue('workbench.editor.openPositioning');
        this.focusRecentEditorAfterClose = this.configurationService.getValue('workbench.editor.focusRecentEditorAfterClose');
    }
    get count() {
        return this.editors.length;
    }
    get stickyCount() {
        return this.sticky + 1;
    }
    getEditors(order, options) {
        const editors = order === 0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */ ? this.mru.slice(0) : this.editors.slice(0);
        if (options?.excludeSticky) {
            // MRU: need to check for index on each
            if (order === 0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */) {
                return editors.filter(editor => !this.isSticky(editor));
            }
            // Sequential: simply start after sticky index
            return editors.slice(this.sticky + 1);
        }
        return editors;
    }
    getEditorByIndex(index) {
        return this.editors[index];
    }
    get activeEditor() {
        return this.active;
    }
    isActive(candidate) {
        return this.matches(this.active, candidate);
    }
    get previewEditor() {
        return this.preview;
    }
    openEditor(candidate, options) {
        const makeSticky = options?.sticky || (typeof options?.index === 'number' && this.isSticky(options.index));
        const makePinned = options?.pinned || options?.sticky;
        const makeTransient = !!options?.transient;
        const makeActive = options?.active || !this.activeEditor || (!makePinned && this.preview === this.activeEditor);
        const existingEditorAndIndex = this.findEditor(candidate, options);
        // New editor
        if (!existingEditorAndIndex) {
            const newEditor = candidate;
            const indexOfActive = this.indexOf(this.active);
            // Insert into specific position
            let targetIndex;
            if (options && typeof options.index === 'number') {
                targetIndex = options.index;
            }
            // Insert to the BEGINNING
            else if (this.editorOpenPositioning === EditorOpenPositioning.FIRST) {
                targetIndex = 0;
                // Always make sure targetIndex is after sticky editors
                // unless we are explicitly told to make the editor sticky
                if (!makeSticky && this.isSticky(targetIndex)) {
                    targetIndex = this.sticky + 1;
                }
            }
            // Insert to the END
            else if (this.editorOpenPositioning === EditorOpenPositioning.LAST) {
                targetIndex = this.editors.length;
            }
            // Insert to LEFT or RIGHT of active editor
            else {
                // Insert to the LEFT of active editor
                if (this.editorOpenPositioning === EditorOpenPositioning.LEFT) {
                    if (indexOfActive === 0 || !this.editors.length) {
                        targetIndex = 0; // to the left becoming first editor in list
                    }
                    else {
                        targetIndex = indexOfActive; // to the left of active editor
                    }
                }
                // Insert to the RIGHT of active editor
                else {
                    targetIndex = indexOfActive + 1;
                }
                // Always make sure targetIndex is after sticky editors
                // unless we are explicitly told to make the editor sticky
                if (!makeSticky && this.isSticky(targetIndex)) {
                    targetIndex = this.sticky + 1;
                }
            }
            // If the editor becomes sticky, increment the sticky index and adjust
            // the targetIndex to be at the end of sticky editors unless already.
            if (makeSticky) {
                this.sticky++;
                if (!this.isSticky(targetIndex)) {
                    targetIndex = this.sticky;
                }
            }
            // Insert into our list of editors if pinned or we have no preview editor
            if (makePinned || !this.preview) {
                this.splice(targetIndex, false, newEditor);
            }
            // Handle transient
            if (makeTransient) {
                this.doSetTransient(newEditor, targetIndex, true);
            }
            // Handle preview
            if (!makePinned) {
                // Replace existing preview with this editor if we have a preview
                if (this.preview) {
                    const indexOfPreview = this.indexOf(this.preview);
                    if (targetIndex > indexOfPreview) {
                        targetIndex--; // accomodate for the fact that the preview editor closes
                    }
                    this.replaceEditor(this.preview, newEditor, targetIndex, !makeActive);
                }
                this.preview = newEditor;
            }
            // Listeners
            this.registerEditorListeners(newEditor);
            // Event
            const event = {
                kind: 5 /* GroupModelChangeKind.EDITOR_OPEN */,
                editor: newEditor,
                editorIndex: targetIndex
            };
            this._onDidModelChange.fire(event);
            // Handle active editor / selected editors
            this.setSelection(makeActive ? newEditor : this.activeEditor, options?.inactiveSelection ?? []);
            return {
                editor: newEditor,
                isNew: true
            };
        }
        // Existing editor
        else {
            const [existingEditor, existingEditorIndex] = existingEditorAndIndex;
            // Update transient (existing editors do not turn transient if they were not before)
            this.doSetTransient(existingEditor, existingEditorIndex, makeTransient === false ? false : this.isTransient(existingEditor));
            // Pin it
            if (makePinned) {
                this.doPin(existingEditor, existingEditorIndex);
            }
            // Handle active editor / selected editors
            this.setSelection(makeActive ? existingEditor : this.activeEditor, options?.inactiveSelection ?? []);
            // Respect index
            if (options && typeof options.index === 'number') {
                this.moveEditor(existingEditor, options.index);
            }
            // Stick it (intentionally after the moveEditor call in case
            // the editor was already moved into the sticky range)
            if (makeSticky) {
                this.doStick(existingEditor, this.indexOf(existingEditor));
            }
            return {
                editor: existingEditor,
                isNew: false
            };
        }
    }
    registerEditorListeners(editor) {
        const listeners = new DisposableStore();
        this.editorListeners.add(listeners);
        // Re-emit disposal of editor input as our own event
        listeners.add(Event.once(editor.onWillDispose)(() => {
            const editorIndex = this.editors.indexOf(editor);
            if (editorIndex >= 0) {
                const event = {
                    kind: 15 /* GroupModelChangeKind.EDITOR_WILL_DISPOSE */,
                    editor,
                    editorIndex
                };
                this._onDidModelChange.fire(event);
            }
        }));
        // Re-Emit dirty state changes
        listeners.add(editor.onDidChangeDirty(() => {
            const event = {
                kind: 14 /* GroupModelChangeKind.EDITOR_DIRTY */,
                editor,
                editorIndex: this.editors.indexOf(editor)
            };
            this._onDidModelChange.fire(event);
        }));
        // Re-Emit label changes
        listeners.add(editor.onDidChangeLabel(() => {
            const event = {
                kind: 9 /* GroupModelChangeKind.EDITOR_LABEL */,
                editor,
                editorIndex: this.editors.indexOf(editor)
            };
            this._onDidModelChange.fire(event);
        }));
        // Re-Emit capability changes
        listeners.add(editor.onDidChangeCapabilities(() => {
            const event = {
                kind: 10 /* GroupModelChangeKind.EDITOR_CAPABILITIES */,
                editor,
                editorIndex: this.editors.indexOf(editor)
            };
            this._onDidModelChange.fire(event);
        }));
        // Clean up dispose listeners once the editor gets closed
        listeners.add(this.onDidModelChange(event => {
            if (event.kind === 6 /* GroupModelChangeKind.EDITOR_CLOSE */ && event.editor?.matches(editor)) {
                dispose(listeners);
                this.editorListeners.delete(listeners);
            }
        }));
    }
    replaceEditor(toReplace, replaceWith, replaceIndex, openNext = true) {
        const closeResult = this.doCloseEditor(toReplace, EditorCloseContext.REPLACE, openNext); // optimization to prevent multiple setActive() in one call
        // We want to first add the new editor into our model before emitting the close event because
        // firing the close event can trigger a dispose on the same editor that is now being added.
        // This can lead into opening a disposed editor which is not what we want.
        this.splice(replaceIndex, false, replaceWith);
        if (closeResult) {
            const event = {
                kind: 6 /* GroupModelChangeKind.EDITOR_CLOSE */,
                ...closeResult
            };
            this._onDidModelChange.fire(event);
        }
    }
    closeEditor(candidate, context = EditorCloseContext.UNKNOWN, openNext = true) {
        const closeResult = this.doCloseEditor(candidate, context, openNext);
        if (closeResult) {
            const event = {
                kind: 6 /* GroupModelChangeKind.EDITOR_CLOSE */,
                ...closeResult
            };
            this._onDidModelChange.fire(event);
            return closeResult;
        }
        return undefined;
    }
    doCloseEditor(candidate, context, openNext) {
        const index = this.indexOf(candidate);
        if (index === -1) {
            return undefined; // not found
        }
        const editor = this.editors[index];
        const sticky = this.isSticky(index);
        // Active editor closed
        const isActiveEditor = this.active === editor;
        if (openNext && isActiveEditor) {
            // More than one editor
            if (this.mru.length > 1) {
                let newActive;
                if (this.focusRecentEditorAfterClose) {
                    newActive = this.mru[1]; // active editor is always first in MRU, so pick second editor after as new active
                }
                else {
                    if (index === this.editors.length - 1) {
                        newActive = this.editors[index - 1]; // last editor is closed, pick previous as new active
                    }
                    else {
                        newActive = this.editors[index + 1]; // pick next editor as new active
                    }
                }
                // Select editor as active
                const newInactiveSelectedEditors = this.selection.filter(selected => selected !== editor && selected !== newActive);
                this.doSetSelection(newActive, this.editors.indexOf(newActive), newInactiveSelectedEditors);
            }
            // Last editor closed: clear selection
            else {
                this.doSetSelection(null, undefined, []);
            }
        }
        // Inactive editor closed
        else if (!isActiveEditor) {
            // Remove editor from inactive selection
            if (this.doIsSelected(editor)) {
                const newInactiveSelectedEditors = this.selection.filter(selected => selected !== editor && selected !== this.activeEditor);
                this.doSetSelection(this.activeEditor, this.indexOf(this.activeEditor), newInactiveSelectedEditors);
            }
        }
        // Preview Editor closed
        if (this.preview === editor) {
            this.preview = null;
        }
        // Remove from transient
        this.transient.delete(editor);
        // Remove from arrays
        this.splice(index, true);
        // Event
        return { editor, sticky, editorIndex: index, context };
    }
    moveEditor(candidate, toIndex) {
        // Ensure toIndex is in bounds of our model
        if (toIndex >= this.editors.length) {
            toIndex = this.editors.length - 1;
        }
        else if (toIndex < 0) {
            toIndex = 0;
        }
        const index = this.indexOf(candidate);
        if (index < 0 || toIndex === index) {
            return;
        }
        const editor = this.editors[index];
        const sticky = this.sticky;
        // Adjust sticky index: editor moved out of sticky state into unsticky state
        if (this.isSticky(index) && toIndex > this.sticky) {
            this.sticky--;
        }
        // ...or editor moved into sticky state from unsticky state
        else if (!this.isSticky(index) && toIndex <= this.sticky) {
            this.sticky++;
        }
        // Move
        this.editors.splice(index, 1);
        this.editors.splice(toIndex, 0, editor);
        // Move Event
        const event = {
            kind: 7 /* GroupModelChangeKind.EDITOR_MOVE */,
            editor,
            oldEditorIndex: index,
            editorIndex: toIndex
        };
        this._onDidModelChange.fire(event);
        // Sticky Event (if sticky changed as part of the move)
        if (sticky !== this.sticky) {
            const event = {
                kind: 13 /* GroupModelChangeKind.EDITOR_STICKY */,
                editor,
                editorIndex: toIndex
            };
            this._onDidModelChange.fire(event);
        }
        return editor;
    }
    setActive(candidate) {
        let result;
        if (!candidate) {
            this.setGroupActive();
        }
        else {
            result = this.setEditorActive(candidate);
        }
        return result;
    }
    setGroupActive() {
        // We do not really keep the `active` state in our model because
        // it has no special meaning to us here. But for consistency
        // we emit a `onDidModelChange` event so that components can
        // react.
        this._onDidModelChange.fire({ kind: 0 /* GroupModelChangeKind.GROUP_ACTIVE */ });
    }
    setEditorActive(candidate) {
        const res = this.findEditor(candidate);
        if (!res) {
            return; // not found
        }
        const [editor, editorIndex] = res;
        this.doSetSelection(editor, editorIndex, []);
        return editor;
    }
    get selectedEditors() {
        return this.editors.filter(editor => this.doIsSelected(editor)); // return in sequential order
    }
    isSelected(editorCandidateOrIndex) {
        let editor;
        if (typeof editorCandidateOrIndex === 'number') {
            editor = this.editors[editorCandidateOrIndex];
        }
        else {
            editor = this.findEditor(editorCandidateOrIndex)?.[0];
        }
        return !!editor && this.doIsSelected(editor);
    }
    doIsSelected(editor) {
        return this.selection.includes(editor);
    }
    setSelection(activeSelectedEditorCandidate, inactiveSelectedEditorCandidates) {
        const res = this.findEditor(activeSelectedEditorCandidate);
        if (!res) {
            return; // not found
        }
        const [activeSelectedEditor, activeSelectedEditorIndex] = res;
        const inactiveSelectedEditors = new Set();
        for (const inactiveSelectedEditorCandidate of inactiveSelectedEditorCandidates) {
            const res = this.findEditor(inactiveSelectedEditorCandidate);
            if (!res) {
                return; // not found
            }
            const [inactiveSelectedEditor] = res;
            if (inactiveSelectedEditor === activeSelectedEditor) {
                continue; // already selected
            }
            inactiveSelectedEditors.add(inactiveSelectedEditor);
        }
        this.doSetSelection(activeSelectedEditor, activeSelectedEditorIndex, Array.from(inactiveSelectedEditors));
    }
    doSetSelection(activeSelectedEditor, activeSelectedEditorIndex, inactiveSelectedEditors) {
        const previousActiveEditor = this.activeEditor;
        const previousSelection = this.selection;
        let newSelection;
        if (activeSelectedEditor) {
            newSelection = [activeSelectedEditor, ...inactiveSelectedEditors];
        }
        else {
            newSelection = [];
        }
        // Update selection
        this.selection = newSelection;
        // Update active editor if it has changed
        const activeEditorChanged = activeSelectedEditor && typeof activeSelectedEditorIndex === 'number' && previousActiveEditor !== activeSelectedEditor;
        if (activeEditorChanged) {
            // Bring to front in MRU list
            const mruIndex = this.indexOf(activeSelectedEditor, this.mru);
            this.mru.splice(mruIndex, 1);
            this.mru.unshift(activeSelectedEditor);
            // Event
            const event = {
                kind: 8 /* GroupModelChangeKind.EDITOR_ACTIVE */,
                editor: activeSelectedEditor,
                editorIndex: activeSelectedEditorIndex
            };
            this._onDidModelChange.fire(event);
        }
        // Fire event if the selection has changed
        if (activeEditorChanged ||
            previousSelection.length !== newSelection.length ||
            previousSelection.some(editor => !newSelection.includes(editor))) {
            const event = {
                kind: 4 /* GroupModelChangeKind.EDITORS_SELECTION */
            };
            this._onDidModelChange.fire(event);
        }
    }
    setIndex(index) {
        // We do not really keep the `index` in our model because
        // it has no special meaning to us here. But for consistency
        // we emit a `onDidModelChange` event so that components can
        // react.
        this._onDidModelChange.fire({ kind: 1 /* GroupModelChangeKind.GROUP_INDEX */ });
    }
    setLabel(label) {
        // We do not really keep the `label` in our model because
        // it has no special meaning to us here. But for consistency
        // we emit a `onDidModelChange` event so that components can
        // react.
        this._onDidModelChange.fire({ kind: 2 /* GroupModelChangeKind.GROUP_LABEL */ });
    }
    pin(candidate) {
        const res = this.findEditor(candidate);
        if (!res) {
            return; // not found
        }
        const [editor, editorIndex] = res;
        this.doPin(editor, editorIndex);
        return editor;
    }
    doPin(editor, editorIndex) {
        if (this.isPinned(editor)) {
            return; // can only pin a preview editor
        }
        // Clear Transient
        this.setTransient(editor, false);
        // Convert the preview editor to be a pinned editor
        this.preview = null;
        // Event
        const event = {
            kind: 11 /* GroupModelChangeKind.EDITOR_PIN */,
            editor,
            editorIndex
        };
        this._onDidModelChange.fire(event);
    }
    unpin(candidate) {
        const res = this.findEditor(candidate);
        if (!res) {
            return; // not found
        }
        const [editor, editorIndex] = res;
        this.doUnpin(editor, editorIndex);
        return editor;
    }
    doUnpin(editor, editorIndex) {
        if (!this.isPinned(editor)) {
            return; // can only unpin a pinned editor
        }
        // Set new
        const oldPreview = this.preview;
        this.preview = editor;
        // Event
        const event = {
            kind: 11 /* GroupModelChangeKind.EDITOR_PIN */,
            editor,
            editorIndex
        };
        this._onDidModelChange.fire(event);
        // Close old preview editor if any
        if (oldPreview) {
            this.closeEditor(oldPreview, EditorCloseContext.UNPIN);
        }
    }
    isPinned(editorCandidateOrIndex) {
        let editor;
        if (typeof editorCandidateOrIndex === 'number') {
            editor = this.editors[editorCandidateOrIndex];
        }
        else {
            editor = editorCandidateOrIndex;
        }
        return !this.matches(this.preview, editor);
    }
    stick(candidate) {
        const res = this.findEditor(candidate);
        if (!res) {
            return; // not found
        }
        const [editor, editorIndex] = res;
        this.doStick(editor, editorIndex);
        return editor;
    }
    doStick(editor, editorIndex) {
        if (this.isSticky(editorIndex)) {
            return; // can only stick a non-sticky editor
        }
        // Pin editor
        this.pin(editor);
        // Move editor to be the last sticky editor
        const newEditorIndex = this.sticky + 1;
        this.moveEditor(editor, newEditorIndex);
        // Adjust sticky index
        this.sticky++;
        // Event
        const event = {
            kind: 13 /* GroupModelChangeKind.EDITOR_STICKY */,
            editor,
            editorIndex: newEditorIndex
        };
        this._onDidModelChange.fire(event);
    }
    unstick(candidate) {
        const res = this.findEditor(candidate);
        if (!res) {
            return; // not found
        }
        const [editor, editorIndex] = res;
        this.doUnstick(editor, editorIndex);
        return editor;
    }
    doUnstick(editor, editorIndex) {
        if (!this.isSticky(editorIndex)) {
            return; // can only unstick a sticky editor
        }
        // Move editor to be the first non-sticky editor
        const newEditorIndex = this.sticky;
        this.moveEditor(editor, newEditorIndex);
        // Adjust sticky index
        this.sticky--;
        // Event
        const event = {
            kind: 13 /* GroupModelChangeKind.EDITOR_STICKY */,
            editor,
            editorIndex: newEditorIndex
        };
        this._onDidModelChange.fire(event);
    }
    isSticky(candidateOrIndex) {
        if (this.sticky < 0) {
            return false; // no sticky editor
        }
        let index;
        if (typeof candidateOrIndex === 'number') {
            index = candidateOrIndex;
        }
        else {
            index = this.indexOf(candidateOrIndex);
        }
        if (index < 0) {
            return false;
        }
        return index <= this.sticky;
    }
    setTransient(candidate, transient) {
        if (!transient && this.transient.size === 0) {
            return; // no transient editor
        }
        const res = this.findEditor(candidate);
        if (!res) {
            return; // not found
        }
        const [editor, editorIndex] = res;
        this.doSetTransient(editor, editorIndex, transient);
        return editor;
    }
    doSetTransient(editor, editorIndex, transient) {
        if (transient) {
            if (this.transient.has(editor)) {
                return;
            }
            this.transient.add(editor);
        }
        else {
            if (!this.transient.has(editor)) {
                return;
            }
            this.transient.delete(editor);
        }
        // Event
        const event = {
            kind: 12 /* GroupModelChangeKind.EDITOR_TRANSIENT */,
            editor,
            editorIndex
        };
        this._onDidModelChange.fire(event);
    }
    isTransient(editorCandidateOrIndex) {
        if (this.transient.size === 0) {
            return false; // no transient editor
        }
        let editor;
        if (typeof editorCandidateOrIndex === 'number') {
            editor = this.editors[editorCandidateOrIndex];
        }
        else {
            editor = this.findEditor(editorCandidateOrIndex)?.[0];
        }
        return !!editor && this.transient.has(editor);
    }
    splice(index, del, editor) {
        const editorToDeleteOrReplace = this.editors[index];
        // Perform on sticky index
        if (del && this.isSticky(index)) {
            this.sticky--;
        }
        // Perform on editors array
        if (editor) {
            this.editors.splice(index, del ? 1 : 0, editor);
        }
        else {
            this.editors.splice(index, del ? 1 : 0);
        }
        // Perform on MRU
        {
            // Add
            if (!del && editor) {
                if (this.mru.length === 0) {
                    // the list of most recent editors is empty
                    // so this editor can only be the most recent
                    this.mru.push(editor);
                }
                else {
                    // we have most recent editors. as such we
                    // put this newly opened editor right after
                    // the current most recent one because it cannot
                    // be the most recently active one unless
                    // it becomes active. but it is still more
                    // active then any other editor in the list.
                    this.mru.splice(1, 0, editor);
                }
            }
            // Remove / Replace
            else {
                const indexInMRU = this.indexOf(editorToDeleteOrReplace, this.mru);
                // Remove
                if (del && !editor) {
                    this.mru.splice(indexInMRU, 1); // remove from MRU
                }
                // Replace
                else if (del && editor) {
                    this.mru.splice(indexInMRU, 1, editor); // replace MRU at location
                }
            }
        }
    }
    indexOf(candidate, editors = this.editors, options) {
        let index = -1;
        if (!candidate) {
            return index;
        }
        for (let i = 0; i < editors.length; i++) {
            const editor = editors[i];
            if (this.matches(editor, candidate, options)) {
                // If we are to support side by side matching, it is possible that
                // a better direct match is found later. As such, we continue finding
                // a matching editor and prefer that match over the side by side one.
                if (options?.supportSideBySide && editor instanceof SideBySideEditorInput && !(candidate instanceof SideBySideEditorInput)) {
                    index = i;
                }
                else {
                    index = i;
                    break;
                }
            }
        }
        return index;
    }
    findEditor(candidate, options) {
        const index = this.indexOf(candidate, this.editors, options);
        if (index === -1) {
            return undefined;
        }
        return [this.editors[index], index];
    }
    isFirst(candidate, editors = this.editors) {
        return this.matches(editors[0], candidate);
    }
    isLast(candidate, editors = this.editors) {
        return this.matches(editors[editors.length - 1], candidate);
    }
    contains(candidate, options) {
        return this.indexOf(candidate, this.editors, options) !== -1;
    }
    matches(editor, candidate, options) {
        if (!editor || !candidate) {
            return false;
        }
        if (options?.supportSideBySide && editor instanceof SideBySideEditorInput && !(candidate instanceof SideBySideEditorInput)) {
            switch (options.supportSideBySide) {
                case SideBySideEditor.ANY:
                    if (this.matches(editor.primary, candidate, options) || this.matches(editor.secondary, candidate, options)) {
                        return true;
                    }
                    break;
                case SideBySideEditor.BOTH:
                    if (this.matches(editor.primary, candidate, options) && this.matches(editor.secondary, candidate, options)) {
                        return true;
                    }
                    break;
            }
        }
        const strictEquals = editor === candidate;
        if (options?.strictEquals) {
            return strictEquals;
        }
        return strictEquals || editor.matches(candidate);
    }
    get isLocked() {
        return this.locked;
    }
    lock(locked) {
        if (this.isLocked !== locked) {
            this.locked = locked;
            this._onDidModelChange.fire({ kind: 3 /* GroupModelChangeKind.GROUP_LOCKED */ });
        }
    }
    clone() {
        const clone = this.instantiationService.createInstance(EditorGroupModel_1, undefined);
        // Copy over group properties
        clone.editors = this.editors.slice(0);
        clone.mru = this.mru.slice(0);
        clone.preview = this.preview;
        clone.selection = this.selection.slice(0);
        clone.sticky = this.sticky;
        // Ensure to register listeners for each editor
        for (const editor of clone.editors) {
            clone.registerEditorListeners(editor);
        }
        return clone;
    }
    serialize() {
        const registry = Registry.as(EditorExtensions.EditorFactory);
        // Serialize all editor inputs so that we can store them.
        // Editors that cannot be serialized need to be ignored
        // from mru, active, preview and sticky if any.
        const serializableEditors = [];
        const serializedEditors = [];
        let serializablePreviewIndex;
        let serializableSticky = this.sticky;
        for (let i = 0; i < this.editors.length; i++) {
            const editor = this.editors[i];
            let canSerializeEditor = false;
            const editorSerializer = registry.getEditorSerializer(editor);
            if (editorSerializer) {
                const value = editorSerializer.canSerialize(editor) ? editorSerializer.serialize(editor) : undefined;
                // Editor can be serialized
                if (typeof value === 'string') {
                    canSerializeEditor = true;
                    serializedEditors.push({ id: editor.typeId, value });
                    serializableEditors.push(editor);
                    if (this.preview === editor) {
                        serializablePreviewIndex = serializableEditors.length - 1;
                    }
                }
                // Editor cannot be serialized
                else {
                    canSerializeEditor = false;
                }
            }
            // Adjust index of sticky editors if the editor cannot be serialized and is pinned
            if (!canSerializeEditor && this.isSticky(i)) {
                serializableSticky--;
            }
        }
        const serializableMru = this.mru.map(editor => this.indexOf(editor, serializableEditors)).filter(i => i >= 0);
        return {
            id: this.id,
            locked: this.locked ? true : undefined,
            editors: serializedEditors,
            mru: serializableMru,
            preview: serializablePreviewIndex,
            sticky: serializableSticky >= 0 ? serializableSticky : undefined
        };
    }
    deserialize(data) {
        const registry = Registry.as(EditorExtensions.EditorFactory);
        if (typeof data.id === 'number') {
            this._id = data.id;
            EditorGroupModel_1.IDS = Math.max(data.id + 1, EditorGroupModel_1.IDS); // make sure our ID generator is always larger
        }
        else {
            this._id = EditorGroupModel_1.IDS++; // backwards compatibility
        }
        if (data.locked) {
            this.locked = true;
        }
        this.editors = coalesce(data.editors.map((e, index) => {
            let editor;
            const editorSerializer = registry.getEditorSerializer(e.id);
            if (editorSerializer) {
                const deserializedEditor = editorSerializer.deserialize(this.instantiationService, e.value);
                if (deserializedEditor instanceof EditorInput) {
                    editor = deserializedEditor;
                    this.registerEditorListeners(editor);
                }
            }
            if (!editor && typeof data.sticky === 'number' && index <= data.sticky) {
                data.sticky--; // if editor cannot be deserialized but was sticky, we need to decrease sticky index
            }
            return editor;
        }));
        this.mru = coalesce(data.mru.map(i => this.editors[i]));
        this.selection = this.mru.length > 0 ? [this.mru[0]] : [];
        if (typeof data.preview === 'number') {
            this.preview = this.editors[data.preview];
        }
        if (typeof data.sticky === 'number') {
            this.sticky = data.sticky;
        }
        return this._id;
    }
    dispose() {
        dispose(Array.from(this.editorListeners));
        this.editorListeners.clear();
        this.transient.clear();
        super.dispose();
    }
};
EditorGroupModel = EditorGroupModel_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IConfigurationService)
], EditorGroupModel);
export { EditorGroupModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yR3JvdXBNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29tbW9uL2VkaXRvci9lZGl0b3JHcm91cE1vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBeUQsZ0JBQWdCLEVBQXVCLGdCQUFnQixFQUFFLGtCQUFrQixFQUE2QyxNQUFNLGNBQWMsQ0FBQztBQUM3TSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDL0MsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDbkUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDaEcsT0FBTyxFQUE2QixxQkFBcUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzNILE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFMUQsTUFBTSxxQkFBcUIsR0FBRztJQUM3QixJQUFJLEVBQUUsTUFBTTtJQUNaLEtBQUssRUFBRSxPQUFPO0lBQ2QsS0FBSyxFQUFFLE9BQU87SUFDZCxJQUFJLEVBQUUsTUFBTTtDQUNaLENBQUM7QUErQkYsTUFBTSxVQUFVLDRCQUE0QixDQUFDLEtBQWU7SUFDM0QsTUFBTSxTQUFTLEdBQUcsS0FBZ0QsQ0FBQztJQUVuRSxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE9B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