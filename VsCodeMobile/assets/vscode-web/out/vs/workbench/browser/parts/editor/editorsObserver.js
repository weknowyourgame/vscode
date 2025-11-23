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
var EditorsObserver_1;
import { EditorExtensions } from '../../../common/editor.js';
import { SideBySideEditorInput } from '../../../common/editor/sideBySideEditorInput.js';
import { dispose, Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { LinkedMap, ResourceMap } from '../../../../base/common/map.js';
import { equals } from '../../../../base/common/objects.js';
/**
 * A observer of opened editors across all editor groups by most recently used.
 * Rules:
 * - the last editor in the list is the one most recently activated
 * - the first editor in the list is the one that was activated the longest time ago
 * - an editor that opens inactive will be placed behind the currently active editor
 *
 * The observer may start to close editors based on the workbench.editor.limit setting.
 */
let EditorsObserver = class EditorsObserver extends Disposable {
    static { EditorsObserver_1 = this; }
    static { this.STORAGE_KEY = 'editors.mru'; }
    get count() {
        return this.mostRecentEditorsMap.size;
    }
    get editors() {
        return [...this.mostRecentEditorsMap.values()];
    }
    hasEditor(editor) {
        const editors = this.editorsPerResourceCounter.get(editor.resource);
        return editors?.has(this.toIdentifier(editor)) ?? false;
    }
    hasEditors(resource) {
        return this.editorsPerResourceCounter.has(resource);
    }
    toIdentifier(arg1, editorId) {
        if (typeof arg1 !== 'string') {
            return this.toIdentifier(arg1.typeId, arg1.editorId);
        }
        if (editorId) {
            return `${arg1}/${editorId}`;
        }
        return arg1;
    }
    constructor(editorGroupsContainer, editorGroupService, storageService) {
        super();
        this.editorGroupService = editorGroupService;
        this.storageService = storageService;
        this.keyMap = new Map();
        this.mostRecentEditorsMap = new LinkedMap();
        this.editorsPerResourceCounter = new ResourceMap();
        this._onDidMostRecentlyActiveEditorsChange = this._register(new Emitter());
        this.onDidMostRecentlyActiveEditorsChange = this._onDidMostRecentlyActiveEditorsChange.event;
        this.editorGroupsContainer = editorGroupsContainer ?? editorGroupService;
        this.isScoped = !!editorGroupsContainer;
        this.registerListeners();
        this.loadState();
    }
    registerListeners() {
        this._register(this.editorGroupsContainer.onDidAddGroup(group => this.onGroupAdded(group)));
        this._register(this.editorGroupService.onDidChangeEditorPartOptions(e => this.onDidChangeEditorPartOptions(e)));
        this._register(this.storageService.onWillSaveState(() => this.saveState()));
    }
    onGroupAdded(group) {
        // Make sure to add any already existing editor
        // of the new group into our list in LRU order
        const groupEditorsMru = group.getEditors(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */);
        for (let i = groupEditorsMru.length - 1; i >= 0; i--) {
            this.addMostRecentEditor(group, groupEditorsMru[i], false /* is not active */, true /* is new */);
        }
        // Make sure that active editor is put as first if group is active
        if (this.editorGroupsContainer.activeGroup === group && group.activeEditor) {
            this.addMostRecentEditor(group, group.activeEditor, true /* is active */, false /* already added before */);
        }
        // Group Listeners
        this.registerGroupListeners(group);
    }
    registerGroupListeners(group) {
        const groupDisposables = new DisposableStore();
        groupDisposables.add(group.onDidModelChange(e => {
            switch (e.kind) {
                // Group gets active: put active editor as most recent
                case 0 /* GroupModelChangeKind.GROUP_ACTIVE */: {
                    if (this.editorGroupsContainer.activeGroup === group && group.activeEditor) {
                        this.addMostRecentEditor(group, group.activeEditor, true /* is active */, false /* editor already opened */);
                    }
                    break;
                }
                // Editor opens: put it as second most recent
                //
                // Also check for maximum allowed number of editors and
                // start to close oldest ones if needed.
                case 5 /* GroupModelChangeKind.EDITOR_OPEN */: {
                    if (e.editor) {
                        this.addMostRecentEditor(group, e.editor, false /* is not active */, true /* is new */);
                        this.ensureOpenedEditorsLimit({ groupId: group.id, editor: e.editor }, group.id);
                    }
                    break;
                }
            }
        }));
        // Editor closes: remove from recently opened
        groupDisposables.add(group.onDidCloseEditor(e => {
            this.removeMostRecentEditor(group, e.editor);
        }));
        // Editor gets active: put active editor as most recent
        // if group is active, otherwise second most recent
        groupDisposables.add(group.onDidActiveEditorChange(e => {
            if (e.editor) {
                this.addMostRecentEditor(group, e.editor, this.editorGroupsContainer.activeGroup === group, false /* editor already opened */);
            }
        }));
        // Make sure to cleanup on dispose
        Event.once(group.onWillDispose)(() => dispose(groupDisposables));
    }
    onDidChangeEditorPartOptions(event) {
        if (!equals(event.newPartOptions.limit, event.oldPartOptions.limit)) {
            const activeGroup = this.editorGroupsContainer.activeGroup;
            let exclude = undefined;
            if (activeGroup.activeEditor) {
                exclude = { editor: activeGroup.activeEditor, groupId: activeGroup.id };
            }
            this.ensureOpenedEditorsLimit(exclude);
        }
    }
    addMostRecentEditor(group, editor, isActive, isNew) {
        const key = this.ensureKey(group, editor);
        const mostRecentEditor = this.mostRecentEditorsMap.first;
        // Active or first entry: add to end of map
        if (isActive || !mostRecentEditor) {
            this.mostRecentEditorsMap.set(key, key, mostRecentEditor ? 1 /* Touch.AsOld */ : undefined);
        }
        // Otherwise: insert before most recent
        else {
            // we have most recent editors. as such we
            // put this newly opened editor right before
            // the current most recent one because it cannot
            // be the most recently active one unless
            // it becomes active. but it is still more
            // active then any other editor in the list.
            this.mostRecentEditorsMap.set(key, key, 1 /* Touch.AsOld */);
            this.mostRecentEditorsMap.set(mostRecentEditor, mostRecentEditor, 1 /* Touch.AsOld */);
        }
        // Update in resource map if this is a new editor
        if (isNew) {
            this.updateEditorResourcesMap(editor, true);
        }
        // Event
        this._onDidMostRecentlyActiveEditorsChange.fire();
    }
    updateEditorResourcesMap(editor, add) {
        // Distill the editor resource and type id with support
        // for side by side editor's primary side too.
        let resource = undefined;
        let typeId = undefined;
        let editorId = undefined;
        if (editor instanceof SideBySideEditorInput) {
            resource = editor.primary.resource;
            typeId = editor.primary.typeId;
            editorId = editor.primary.editorId;
        }
        else {
            resource = editor.resource;
            typeId = editor.typeId;
            editorId = editor.editorId;
        }
        if (!resource) {
            return; // require a resource
        }
        const identifier = this.toIdentifier(typeId, editorId);
        // Add entry
        if (add) {
            let editorsPerResource = this.editorsPerResourceCounter.get(resource);
            if (!editorsPerResource) {
                editorsPerResource = new Map();
                this.editorsPerResourceCounter.set(resource, editorsPerResource);
            }
            editorsPerResource.set(identifier, (editorsPerResource.get(identifier) ?? 0) + 1);
        }
        // Remove entry
        else {
            const editorsPerResource = this.editorsPerResourceCounter.get(resource);
            if (editorsPerResource) {
                const counter = editorsPerResource.get(identifier) ?? 0;
                if (counter > 1) {
                    editorsPerResource.set(identifier, counter - 1);
                }
                else {
                    editorsPerResource.delete(identifier);
                    if (editorsPerResource.size === 0) {
                        this.editorsPerResourceCounter.delete(resource);
                    }
                }
            }
        }
    }
    removeMostRecentEditor(group, editor) {
        // Update in resource map
        this.updateEditorResourcesMap(editor, false);
        // Update in MRU list
        const key = this.findKey(group, editor);
        if (key) {
            // Remove from most recent editors
            this.mostRecentEditorsMap.delete(key);
            // Remove from key map
            const map = this.keyMap.get(group.id);
            if (map?.delete(key.editor) && map.size === 0) {
                this.keyMap.delete(group.id);
            }
            // Event
            this._onDidMostRecentlyActiveEditorsChange.fire();
        }
    }
    findKey(group, editor) {
        const groupMap = this.keyMap.get(group.id);
        if (!groupMap) {
            return undefined;
        }
        return groupMap.get(editor);
    }
    ensureKey(group, editor) {
        let groupMap = this.keyMap.get(group.id);
        if (!groupMap) {
            groupMap = new Map();
            this.keyMap.set(group.id, groupMap);
        }
        let key = groupMap.get(editor);
        if (!key) {
            key = { groupId: group.id, editor };
            groupMap.set(editor, key);
        }
        return key;
    }
    async ensureOpenedEditorsLimit(exclude, groupId) {
        if (!this.editorGroupService.partOptions.limit?.enabled ||
            typeof this.editorGroupService.partOptions.limit.value !== 'number' ||
            this.editorGroupService.partOptions.limit.value <= 0) {
            return; // return early if not enabled or invalid
        }
        const limit = this.editorGroupService.partOptions.limit.value;
        // In editor group
        if (this.editorGroupService.partOptions.limit?.perEditorGroup) {
            // For specific editor groups
            if (typeof groupId === 'number') {
                const group = this.editorGroupsContainer.getGroup(groupId);
                if (group) {
                    await this.doEnsureOpenedEditorsLimit(limit, group.getEditors(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */).map(editor => ({ editor, groupId })), exclude);
                }
            }
            // For all editor groups
            else {
                for (const group of this.editorGroupsContainer.groups) {
                    await this.ensureOpenedEditorsLimit(exclude, group.id);
                }
            }
        }
        // Across all editor groups
        else {
            await this.doEnsureOpenedEditorsLimit(limit, [...this.mostRecentEditorsMap.values()], exclude);
        }
    }
    async doEnsureOpenedEditorsLimit(limit, mostRecentEditors, exclude) {
        // Check for `excludeDirty` setting and apply it by excluding
        // any recent editor that is dirty from the opened editors limit
        let mostRecentEditorsCountingForLimit;
        if (this.editorGroupService.partOptions.limit?.excludeDirty) {
            mostRecentEditorsCountingForLimit = mostRecentEditors.filter(({ editor }) => {
                if ((editor.isDirty() && !editor.isSaving()) || editor.hasCapability(512 /* EditorInputCapabilities.Scratchpad */)) {
                    return false; // not dirty editors (unless in the process of saving) or scratchpads
                }
                return true;
            });
        }
        else {
            mostRecentEditorsCountingForLimit = mostRecentEditors;
        }
        if (limit >= mostRecentEditorsCountingForLimit.length) {
            return; // only if opened editors exceed setting and is valid and enabled
        }
        // Extract least recently used editors that can be closed
        const leastRecentlyClosableEditors = mostRecentEditorsCountingForLimit.reverse().filter(({ editor, groupId }) => {
            if ((editor.isDirty() && !editor.isSaving()) || editor.hasCapability(512 /* EditorInputCapabilities.Scratchpad */)) {
                return false; // not dirty editors (unless in the process of saving) or scratchpads
            }
            if (exclude && editor === exclude.editor && groupId === exclude.groupId) {
                return false; // never the editor that should be excluded
            }
            if (this.editorGroupsContainer.getGroup(groupId)?.isSticky(editor)) {
                return false; // never sticky editors
            }
            return true;
        });
        // Close editors until we reached the limit again
        let editorsToCloseCount = mostRecentEditorsCountingForLimit.length - limit;
        const mapGroupToEditorsToClose = new Map();
        for (const { groupId, editor } of leastRecentlyClosableEditors) {
            let editorsInGroupToClose = mapGroupToEditorsToClose.get(groupId);
            if (!editorsInGroupToClose) {
                editorsInGroupToClose = [];
                mapGroupToEditorsToClose.set(groupId, editorsInGroupToClose);
            }
            editorsInGroupToClose.push(editor);
            editorsToCloseCount--;
            if (editorsToCloseCount === 0) {
                break; // limit reached
            }
        }
        for (const [groupId, editors] of mapGroupToEditorsToClose) {
            const group = this.editorGroupsContainer.getGroup(groupId);
            if (group) {
                await group.closeEditors(editors, { preserveFocus: true });
            }
        }
    }
    saveState() {
        if (this.isScoped) {
            return; // do not persist state when scoped
        }
        if (this.mostRecentEditorsMap.isEmpty()) {
            this.storageService.remove(EditorsObserver_1.STORAGE_KEY, 1 /* StorageScope.WORKSPACE */);
        }
        else {
            this.storageService.store(EditorsObserver_1.STORAGE_KEY, JSON.stringify(this.serialize()), 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        }
    }
    serialize() {
        const registry = Registry.as(EditorExtensions.EditorFactory);
        const entries = [...this.mostRecentEditorsMap.values()];
        const mapGroupToSerializableEditorsOfGroup = new Map();
        return {
            entries: coalesce(entries.map(({ editor, groupId }) => {
                // Find group for entry
                const group = this.editorGroupsContainer.getGroup(groupId);
                if (!group) {
                    return undefined;
                }
                // Find serializable editors of group
                let serializableEditorsOfGroup = mapGroupToSerializableEditorsOfGroup.get(group);
                if (!serializableEditorsOfGroup) {
                    serializableEditorsOfGroup = group.getEditors(1 /* EditorsOrder.SEQUENTIAL */).filter(editor => {
                        const editorSerializer = registry.getEditorSerializer(editor);
                        return editorSerializer?.canSerialize(editor);
                    });
                    mapGroupToSerializableEditorsOfGroup.set(group, serializableEditorsOfGroup);
                }
                // Only store the index of the editor of that group
                // which can be undefined if the editor is not serializable
                const index = serializableEditorsOfGroup.indexOf(editor);
                if (index === -1) {
                    return undefined;
                }
                return { groupId, index };
            }))
        };
    }
    async loadState() {
        if (this.editorGroupsContainer === this.editorGroupService.mainPart || this.editorGroupsContainer === this.editorGroupService) {
            await this.editorGroupService.whenReady;
        }
        // Previous state: Load editors map from persisted state
        // unless we are running in scoped mode
        let hasRestorableState = false;
        if (!this.isScoped) {
            const serialized = this.storageService.get(EditorsObserver_1.STORAGE_KEY, 1 /* StorageScope.WORKSPACE */);
            if (serialized) {
                hasRestorableState = true;
                this.deserialize(JSON.parse(serialized));
            }
        }
        // No previous state: best we can do is add each editor
        // from oldest to most recently used editor group
        if (!hasRestorableState) {
            const groups = this.editorGroupsContainer.getGroups(1 /* GroupsOrder.MOST_RECENTLY_ACTIVE */);
            for (let i = groups.length - 1; i >= 0; i--) {
                const group = groups[i];
                const groupEditorsMru = group.getEditors(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */);
                for (let i = groupEditorsMru.length - 1; i >= 0; i--) {
                    this.addMostRecentEditor(group, groupEditorsMru[i], true /* enforce as active to preserve order */, true /* is new */);
                }
            }
        }
        // Ensure we listen on group changes for those that exist on startup
        for (const group of this.editorGroupsContainer.groups) {
            this.registerGroupListeners(group);
        }
    }
    deserialize(serialized) {
        const mapValues = [];
        for (const { groupId, index } of serialized.entries) {
            // Find group for entry
            const group = this.editorGroupsContainer.getGroup(groupId);
            if (!group) {
                continue;
            }
            // Find editor for entry
            const editor = group.getEditorByIndex(index);
            if (!editor) {
                continue;
            }
            // Make sure key is registered as well
            const editorIdentifier = this.ensureKey(group, editor);
            mapValues.push([editorIdentifier, editorIdentifier]);
            // Update in resource map
            this.updateEditorResourcesMap(editor, true);
        }
        // Fill map with deserialized values
        this.mostRecentEditorsMap.fromJSON(mapValues);
    }
};
EditorsObserver = EditorsObserver_1 = __decorate([
    __param(1, IEditorGroupsService),
    __param(2, IStorageService)
], EditorsObserver);
export { EditorsObserver };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yc09ic2VydmVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JzT2JzZXJ2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBOEQsZ0JBQWdCLEVBQThGLE1BQU0sMkJBQTJCLENBQUM7QUFFck4sT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDeEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDNUYsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsb0JBQW9CLEVBQXFELE1BQU0sd0RBQXdELENBQUM7QUFDakosT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxTQUFTLEVBQVMsV0FBVyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDL0UsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBYTVEOzs7Ozs7OztHQVFHO0FBQ0ksSUFBTSxlQUFlLEdBQXJCLE1BQU0sZUFBZ0IsU0FBUSxVQUFVOzthQUV0QixnQkFBVyxHQUFHLGFBQWEsQUFBaEIsQ0FBaUI7SUFTcEQsSUFBSSxLQUFLO1FBQ1IsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxJQUFJLE9BQU87UUFDVixPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENB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