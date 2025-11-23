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
import { DataTransfers } from '../../base/browser/dnd.js';
import { DragAndDropObserver, EventType, addDisposableListener, onDidRegisterWindow } from '../../base/browser/dom.js';
import { coalesce } from '../../base/common/arrays.js';
import { UriList } from '../../base/common/dataTransfer.js';
import { Emitter, Event } from '../../base/common/event.js';
import { Disposable, DisposableStore, markAsSingleton } from '../../base/common/lifecycle.js';
import { stringify } from '../../base/common/marshalling.js';
import { Mimes } from '../../base/common/mime.js';
import { FileAccess, Schemas } from '../../base/common/network.js';
import { isWindows } from '../../base/common/platform.js';
import { basename, isEqual } from '../../base/common/resources.js';
import { URI } from '../../base/common/uri.js';
import { CodeDataTransfers, Extensions, LocalSelectionTransfer, createDraggedEditorInputFromRawResourcesData, extractEditorsAndFilesDropData } from '../../platform/dnd/browser/dnd.js';
import { IFileService } from '../../platform/files/common/files.js';
import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../platform/label/common/label.js';
import { extractSelection, withSelection } from '../../platform/opener/common/opener.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { IWorkspaceContextService, hasWorkspaceFileExtension, isTemporaryWorkspace } from '../../platform/workspace/common/workspace.js';
import { IWorkspacesService } from '../../platform/workspaces/common/workspaces.js';
import { EditorResourceAccessor, isEditorIdentifier, isResourceDiffEditorInput, isResourceMergeEditorInput, isResourceSideBySideEditorInput } from '../common/editor.js';
import { IEditorService } from '../services/editor/common/editorService.js';
import { IHostService } from '../services/host/browser/host.js';
import { ITextFileService } from '../services/textfile/common/textfiles.js';
import { IWorkspaceEditingService } from '../services/workspaces/common/workspaceEditing.js';
import { mainWindow } from '../../base/browser/window.js';
import { BroadcastDataChannel } from '../../base/browser/broadcast.js';
//#region Editor / Resources DND
export class DraggedEditorIdentifier {
    constructor(identifier) {
        this.identifier = identifier;
    }
}
export class DraggedEditorGroupIdentifier {
    constructor(identifier) {
        this.identifier = identifier;
    }
}
export async function extractTreeDropData(dataTransfer) {
    const editors = [];
    const resourcesKey = Mimes.uriList.toLowerCase();
    // Data Transfer: Resources
    if (dataTransfer.has(resourcesKey)) {
        try {
            const asString = await dataTransfer.get(resourcesKey)?.asString();
            const rawResourcesData = JSON.stringify(UriList.parse(asString ?? ''));
            editors.push(...createDraggedEditorInputFromRawResourcesData(rawResourcesData));
        }
        catch (error) {
            // Invalid transfer
        }
    }
    return editors;
}
/**
 * Shared function across some components to handle drag & drop of resources.
 * E.g. of folders and workspace files to open them in the window instead of
 * the editor or to handle dirty editors being dropped between instances of Code.
 */
let ResourcesDropHandler = class ResourcesDropHandler {
    constructor(options, fileService, workspacesService, editorService, workspaceEditingService, hostService, contextService, instantiationService) {
        this.options = options;
        this.fileService = fileService;
        this.workspacesService = workspacesService;
        this.editorService = editorService;
        this.workspaceEditingService = workspaceEditingService;
        this.hostService = hostService;
        this.contextService = contextService;
        this.instantiationService = instantiationService;
    }
    async handleDrop(event, targetWindow, resolveTargetGroup, afterDrop, options) {
        const editors = await this.instantiationService.invokeFunction(accessor => extractEditorsAndFilesDropData(accessor, event));
        if (!editors.length) {
            return;
        }
        // Make the window active to handle the drop properly within
        await this.hostService.focus(targetWindow);
        // Check for workspace file / folder being dropped if we are allowed to do so
        if (this.options.allowWorkspaceOpen) {
            const localFilesAllowedToOpenAsWorkspace = coalesce(editors.filter(editor => editor.allowWorkspaceOpen && editor.resource?.scheme === Schemas.file).map(editor => editor.resource));
            if (localFilesAllowedToOpenAsWorkspace.length > 0) {
                const isWorkspaceOpening = await this.handleWorkspaceDrop(localFilesAllowedToOpenAsWorkspace);
                if (isWorkspaceOpening) {
                    return; // return early if the drop operation resulted in this window changing to a workspace
                }
            }
        }
        // Add external ones to recently open list unless dropped resource is a workspace
        const externalLocalFiles = coalesce(editors.filter(editor => editor.isExternal && editor.resource?.scheme === Schemas.file).map(editor => editor.resource));
        if (externalLocalFiles.length) {
            this.workspacesService.addRecentlyOpened(externalLocalFiles.map(resource => ({ fileUri: resource })));
        }
        // Open in Editor
        const targetGroup = resolveTargetGroup?.();
        await this.editorService.openEditors(editors.map(editor => ({
            ...editor,
            resource: editor.resource,
            options: {
                ...editor.options,
                ...options,
                pinned: true
            }
        })), targetGroup, { validateTrust: true });
        // Finish with provided function
        afterDrop?.(targetGroup);
    }
    async handleWorkspaceDrop(resources) {
        const toOpen = [];
        const folderURIs = [];
        await Promise.all(resources.map(async (resource) => {
            // Check for Workspace
            if (hasWorkspaceFileExtension(resource)) {
                toOpen.push({ workspaceUri: resource });
                return;
            }
            // Check for Folder
            try {
                const stat = await this.fileService.stat(resource);
                if (stat.isDirectory) {
                    toOpen.push({ folderUri: stat.resource });
                    folderURIs.push({ uri: stat.resource });
                }
            }
            catch (error) {
                // Ignore error
            }
        }));
        // Return early if no external resource is a folder or workspace
        if (toOpen.length === 0) {
            return false;
        }
        // Open in separate windows if we drop workspaces or just one folder
        if (toOpen.length > folderURIs.length || folderURIs.length === 1) {
            await this.hostService.openWindow(toOpen);
        }
        // Add to workspace if we are in a temporary workspace
        else if (isTemporaryWorkspace(this.contextService.getWorkspace())) {
            await this.workspaceEditingService.addFolders(folderURIs);
        }
        // Finally, enter untitled workspace when dropping >1 folders
        else {
            await this.workspaceEditingService.createAndEnterWorkspace(folderURIs);
        }
        return true;
    }
};
ResourcesDropHandler = __decorate([
    __param(1, IFileService),
    __param(2, IWorkspacesService),
    __param(3, IEditorService),
    __param(4, IWorkspaceEditingService),
    __param(5, IHostService),
    __param(6, IWorkspaceContextService),
    __param(7, IInstantiationService)
], ResourcesDropHandler);
export { ResourcesDropHandler };
export function fillEditorsDragData(accessor, resourcesOrEditors, event, options) {
    if (resourcesOrEditors.length === 0 || !event.dataTransfer) {
        return;
    }
    const textFileService = accessor.get(ITextFileService);
    const editorService = accessor.get(IEditorService);
    const fileService = accessor.get(IFileService);
    const labelService = accessor.get(ILabelService);
    // Extract resources from URIs or Editors that
    // can be handled by the file service
    const resources = coalesce(resourcesOrEditors.map((resourceOrEditor) => {
        if (URI.isUri(resourceOrEditor)) {
            return { resource: resourceOrEditor };
        }
        if (isEditorIdentifier(resourceOrEditor)) {
            if (URI.isUri(resourceOrEditor.editor.resource)) {
                return { resource: resourceOrEditor.editor.resource };
            }
            return undefined; // editor without resource
        }
        return {
            resource: resourceOrEditor.selection ? withSelection(resourceOrEditor.resource, resourceOrEditor.selection) : resourceOrEditor.resource,
            isDirectory: resourceOrEditor.isDirectory,
            selection: resourceOrEditor.selection,
        };
    }));
    const fileSystemResources = resources.filter(({ resource }) => fileService.hasProvider(resource));
    if (!options?.disableStandardTransfer) {
        // Text: allows to paste into text-capable areas
        const lineDelimiter = isWindows ? '\r\n' : '\n';
        event.dataTransfer.setData(DataTransfers.TEXT, fileSystemResources.map(({ resource }) => labelService.getUriLabel(resource, { noPrefix: true })).join(lineDelimiter));
        // Download URL: enables support to drag a tab as file to desktop
        // Requirements:
        // - Chrome/Edge only
        // - only a single file is supported
        // - only file:/ resources are supported
        const firstFile = fileSystemResources.find(({ isDirectory }) => !isDirectory);
        if (firstFile) {
            const firstFileUri = FileAccess.uriToFileUri(firstFile.resource); // enforce `file:` URIs
            if (firstFileUri.scheme === Schemas.file) {
                event.dataTransfer.setData(DataTransfers.DOWNLOAD_URL, [Mimes.binary, basename(firstFile.resource), firstFileUri.toString()].join(':'));
            }
        }
    }
    // Resource URLs: allows to drop multiple file resources to a target in VS Code
    const files = fileSystemResources.filter(({ isDirectory }) => !isDirectory);
    if (files.length) {
        event.dataTransfer.setData(DataTransfers.RESOURCES, JSON.stringify(files.map(({ resource }) => resource.toString())));
    }
    // Contributions
    const contributions = Registry.as(Extensions.DragAndDropContribution).getAll();
    for (const contribution of contributions) {
        contribution.setData(resources, event);
    }
    // Editors: enables cross window DND of editors
    // into the editor area while presering UI state
    const draggedEditors = [];
    for (const resourceOrEditor of resourcesOrEditors) {
        // Extract resource editor from provided object or URI
        let editor = undefined;
        if (isEditorIdentifier(resourceOrEditor)) {
            const untypedEditor = resourceOrEditor.editor.toUntyped({ preserveViewState: resourceOrEditor.groupId });
            if (untypedEditor) {
                editor = { ...untypedEditor, resource: EditorResourceAccessor.getCanonicalUri(untypedEditor) };
            }
        }
        else if (URI.isUri(resourceOrEditor)) {
            const { selection, uri } = extractSelection(resourceOrEditor);
            editor = { resource: uri, options: selection ? { selection } : undefined };
        }
        else if (!resourceOrEditor.isDirectory) {
            editor = {
                resource: resourceOrEditor.resource,
                options: {
                    selection: resourceOrEditor.selection,
                }
            };
        }
        if (!editor) {
            continue; // skip over editors that cannot be transferred via dnd
        }
        // Fill in some properties if they are not there already by accessing
        // some well known things from the text file universe.
        // This is not ideal for custom editors, but those have a chance to
        // provide everything from the `toUntyped` method.
        {
            const resource = editor.resource;
            if (resource) {
                const textFileModel = textFileService.files.get(resource);
                if (textFileModel) {
                    // language
                    if (typeof editor.languageId !== 'string') {
                        editor.languageId = textFileModel.getLanguageId();
                    }
                    // encoding
                    if (typeof editor.encoding !== 'string') {
                        editor.encoding = textFileModel.getEncoding();
                    }
                    // contents (only if dirty and not too large)
                    if (typeof editor.contents !== 'string' && textFileModel.isDirty() && !textFileModel.textEditorModel.isTooLargeForHeapOperation()) {
                        editor.contents = textFileModel.textEditorModel.getValue();
                    }
                }
                // viewState
                if (!editor.options?.viewState) {
                    editor.options = {
                        ...editor.options,
                        viewState: (() => {
                            for (const visibleEditorPane of editorService.visibleEditorPanes) {
                                if (isEqual(visibleEditorPane.input.resource, resource)) {
                                    const viewState = visibleEditorPane.getViewState();
                                    if (viewState) {
                                        return viewState;
                                    }
                                }
                            }
                            return undefined;
                        })()
                    };
                }
            }
        }
        // Add as dragged editor
        draggedEditors.push(editor);
    }
    if (draggedEditors.length) {
        event.dataTransfer.setData(CodeDataTransfers.EDITORS, stringify(draggedEditors));
    }
    // Add a URI list entry
    const draggedDirectories = fileSystemResources.filter(({ isDirectory }) => isDirectory).map(({ resource }) => resource);
    if (draggedEditors.length || draggedDirectories.length) {
        const uriListEntries = [...draggedDirectories];
        for (const editor of draggedEditors) {
            if (editor.resource) {
                uriListEntries.push(editor.options?.selection ? withSelection(editor.resource, editor.options.selection) : editor.resource);
            }
            else if (isResourceDiffEditorInput(editor)) {
                if (editor.modified.resource) {
                    uriListEntries.push(editor.modified.resource);
                }
            }
            else if (isResourceSideBySideEditorInput(editor)) {
                if (editor.primary.resource) {
                    uriListEntries.push(editor.primary.resource);
                }
            }
            else if (isResourceMergeEditorInput(editor)) {
                uriListEntries.push(editor.result.resource);
            }
        }
        // Due to https://bugs.chromium.org/p/chromium/issues/detail?id=239745, we can only set
        // a single uri for the real `text/uri-list` type. Otherwise all uris end up joined together
        // However we write the full uri-list to an internal type so that other parts of VS Code
        // can use the full list.
        if (!options?.disableStandardTransfer) {
            event.dataTransfer.setData(Mimes.uriList, UriList.create(uriListEntries.slice(0, 1)));
        }
        event.dataTransfer.setData(DataTransfers.INTERNAL_URI_LIST, UriList.create(uriListEntries));
    }
}
export class CompositeDragAndDropData {
    constructor(type, id) {
        this.type = type;
        this.id = id;
    }
    update(dataTransfer) {
        // no-op
    }
    getData() {
        return { type: this.type, id: this.id };
    }
}
export class DraggedCompositeIdentifier {
    constructor(compositeId) {
        this.compositeId = compositeId;
    }
    get id() {
        return this.compositeId;
    }
}
export class DraggedViewIdentifier {
    constructor(viewId) {
        this.viewId = viewId;
    }
    get id() {
        return this.viewId;
    }
}
export class CompositeDragAndDropObserver extends Disposable {
    static get INSTANCE() {
        if (!CompositeDragAndDropObserver.instance) {
            CompositeDragAndDropObserver.instance = new CompositeDragAndDropObserver();
            markAsSingleton(CompositeDragAndDropObserver.instance);
        }
        return CompositeDragAndDropObserver.instance;
    }
    constructor() {
        super();
        this.transferData = LocalSelectionTransfer.getInstance();
        this.onDragStart = this._register(new Emitter());
        this.onDragEnd = this._register(new Emitter());
        this._register(this.onDragEnd.event(e => {
            const id = e.dragAndDropData.getData().id;
            const type = e.dragAndDropData.getData().type;
            const data = this.readDragData(type);
            if (data?.getData().id === id) {
                this.transferData.clearData(type === 'view' ? DraggedViewIdentifier.prototype : DraggedCompositeIdentifier.prototype);
            }
        }));
    }
    readDragData(type) {
        if (this.transferData.hasData(type === 'view' ? DraggedViewIdentifier.prototype : DraggedCompositeIdentifier.prototype)) {
            const data = this.transferData.getData(type === 'view' ? DraggedViewIdentifier.prototype : DraggedCompositeIdentifier.prototype);
            if (data?.[0]) {
                return new CompositeDragAndDropData(type, data[0].id);
            }
        }
        return undefined;
    }
    writeDragData(id, type) {
        this.transferData.setData([type === 'view' ? new DraggedViewIdentifier(id) : new DraggedCompositeIdentifier(id)], type === 'view' ? DraggedViewIdentifier.prototype : DraggedCompositeIdentifier.prototype);
    }
    registerTarget(element, callbacks) {
        const disposableStore = new DisposableStore();
        disposableStore.add(new DragAndDropObserver(element, {
            onDragEnter: e => {
                e.preventDefault();
                if (callbacks.onDragEnter) {
                    const data = this.readDragData('composite') || this.readDragData('view');
                    if (data) {
                        callbacks.onDragEnter({ eventData: e, dragAndDropData: data });
                    }
                }
            },
            onDragLeave: e => {
                const data = this.readDragData('composite') || this.readDragData('view');
                if (callbacks.onDragLeave && data) {
                    callbacks.onDragLeave({ eventData: e, dragAndDropData: data });
                }
            },
            onDrop: e => {
                if (callbacks.onDrop) {
                    const data = this.readDragData('composite') || this.readDragData('view');
                    if (!data) {
                        return;
                    }
                    callbacks.onDrop({ eventData: e, dragAndDropData: data });
                    // Fire drag event in case drop handler destroys the dragged element
                    this.onDragEnd.fire({ eventData: e, dragAndDropData: data });
                }
            },
            onDragOver: e => {
                e.preventDefault();
                if (callbacks.onDragOver) {
                    const data = this.readDragData('composite') || this.readDragData('view');
                    if (!data) {
                        return;
                    }
                    callbacks.onDragOver({ eventData: e, dragAndDropData: data });
                }
            }
        }));
        if (callbacks.onDragStart) {
            this.onDragStart.event(e => {
                callbacks.onDragStart(e);
            }, this, disposableStore);
        }
        if (callbacks.onDragEnd) {
            this.onDragEnd.event(e => {
                callbacks.onDragEnd(e);
            }, this, disposableStore);
        }
        return this._register(disposableStore);
    }
    registerDraggable(element, draggedItemProvider, callbacks) {
        element.draggable = true;
        const disposableStore = new DisposableStore();
        disposableStore.add(new DragAndDropObserver(element, {
            onDragStart: e => {
                const { id, type } = draggedItemProvider();
                this.writeDragData(id, type);
                e.dataTransfer?.setDragImage(element, 0, 0);
                this.onDragStart.fire({ eventData: e, dragAndDropData: this.readDragData(type) });
            },
            onDragEnd: e => {
                const { type } = draggedItemProvider();
                const data = this.readDragData(type);
                if (!data) {
                    return;
                }
                this.onDragEnd.fire({ eventData: e, dragAndDropData: data });
            },
            onDragEnter: e => {
                if (callbacks.onDragEnter) {
                    const data = this.readDragData('composite') || this.readDragData('view');
                    if (!data) {
                        return;
                    }
                    if (data) {
                        callbacks.onDragEnter({ eventData: e, dragAndDropData: data });
                    }
                }
            },
            onDragLeave: e => {
                const data = this.readDragData('composite') || this.readDragData('view');
                if (!data) {
                    return;
                }
                callbacks.onDragLeave?.({ eventData: e, dragAndDropData: data });
            },
            onDrop: e => {
                if (callbacks.onDrop) {
                    const data = this.readDragData('composite') || this.readDragData('view');
                    if (!data) {
                        return;
                    }
                    callbacks.onDrop({ eventData: e, dragAndDropData: data });
                    // Fire drag event in case drop handler destroys the dragged element
                    this.onDragEnd.fire({ eventData: e, dragAndDropData: data });
                }
            },
            onDragOver: e => {
                if (callbacks.onDragOver) {
                    const data = this.readDragData('composite') || this.readDragData('view');
                    if (!data) {
                        return;
                    }
                    callbacks.onDragOver({ eventData: e, dragAndDropData: data });
                }
            }
        }));
        if (callbacks.onDragStart) {
            this.onDragStart.event(e => {
                callbacks.onDragStart(e);
            }, this, disposableStore);
        }
        if (callbacks.onDragEnd) {
            this.onDragEnd.event(e => {
                callbacks.onDragEnd(e);
            }, this, disposableStore);
        }
        return this._register(disposableStore);
    }
}
export function toggleDropEffect(dataTransfer, dropEffect, shouldHaveIt) {
    if (!dataTransfer) {
        return;
    }
    dataTransfer.dropEffect = shouldHaveIt ? dropEffect : 'none';
}
let ResourceListDnDHandler = class ResourceListDnDHandler {
    constructor(toResource, instantiationService) {
        this.toResource = toResource;
        this.instantiationService = instantiationService;
    }
    getDragURI(element) {
        const resource = this.toResource(element);
        return resource ? resource.toString() : null;
    }
    getDragLabel(elements) {
        const resources = coalesce(elements.map(this.toResource));
        return resources.length === 1 ? basename(resources[0]) : resources.length > 1 ? String(resources.length) : undefined;
    }
    onDragStart(data, originalEvent) {
        const resources = [];
        const elements = data.elements;
        for (const element of elements) {
            const resource = this.toResource(element);
            if (resource) {
                resources.push(resource);
            }
        }
        this.onWillDragElements(elements, originalEvent);
        if (resources.length) {
            // Apply some datatransfer types to allow for dragging the element outside of the application
            this.instantiationService.invokeFunction(accessor => fillEditorsDragData(accessor, resources, originalEvent));
        }
    }
    onWillDragElements(elements, originalEvent) {
        // noop
    }
    onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
        return false;
    }
    drop(data, targetElement, targetIndex, targetSector, originalEvent) { }
    dispose() { }
};
ResourceListDnDHandler = __decorate([
    __param(1, IInstantiationService)
], ResourceListDnDHandler);
export { ResourceListDnDHandler };
//#endregion
class GlobalWindowDraggedOverTracker extends Disposable {
    static { this.CHANNEL_NAME = 'monaco-workbench-global-dragged-over'; }
    constructor() {
        super();
        this.broadcaster = this._register(new BroadcastDataChannel(GlobalWindowDraggedOverTracker.CHANNEL_NAME));
        this.draggedOver = false;
        this.registerListeners();
    }
    registerListeners() {
        this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
            disposables.add(addDisposableListener(window, EventType.DRAG_OVER, () => this.markDraggedOver(false), true));
            disposables.add(addDisposableListener(window, EventType.DRAG_LEAVE, () => this.clearDraggedOver(false), true));
        }, { window: mainWindow, disposables: this._store }));
        this._register(this.broadcaster.onDidReceiveData(data => {
            if (data === true) {
                this.markDraggedOver(true);
            }
            else {
                this.clearDraggedOver(true);
            }
        }));
    }
    get isDraggedOver() { return this.draggedOver; }
    markDraggedOver(fromBroadcast) {
        if (this.draggedOver === true) {
            return; // alrady marked
        }
        this.draggedOver = true;
        if (!fromBroadcast) {
            this.broadcaster.postData(true);
        }
    }
    clearDraggedOver(fromBroadcast) {
        if (this.draggedOver === false) {
            return; // alrady cleared
        }
        this.draggedOver = false;
        if (!fromBroadcast) {
            this.broadcaster.postData(false);
        }
    }
}
const globalDraggedOverTracker = new GlobalWindowDraggedOverTracker();
/**
 * Returns whether the workbench is currently dragged over in any of
 * the opened windows (main windows and auxiliary windows).
 */
export function isWindowDraggedOver() {
    return globalDraggedOverTracker.isDraggedOver;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG5kLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9icm93c2VyL2RuZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsYUFBYSxFQUFvQixNQUFNLDJCQUEyQixDQUFDO0FBQzVFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxTQUFTLEVBQUUscUJBQXFCLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUt2SCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFFLE9BQU8sRUFBa0IsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLGVBQWUsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzNHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDbEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNuRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDMUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFVBQVUsRUFBZ0Ysc0JBQXNCLEVBQUUsNENBQTRDLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN0USxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENB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