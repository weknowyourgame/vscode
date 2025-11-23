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
import './media/customEditor.css';
import { coalesce } from '../../../../base/common/arrays.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { extname, isEqual } from '../../../../base/common/resources.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { RedoCommand, UndoCommand } from '../../../../editor/browser/editorExtensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { DEFAULT_EDITOR_ASSOCIATION, EditorExtensions } from '../../../common/editor.js';
import { DiffEditorInput } from '../../../common/editor/diffEditorInput.js';
import { CONTEXT_ACTIVE_CUSTOM_EDITOR_ID, CONTEXT_FOCUSED_CUSTOM_EDITOR_IS_EDITABLE, CustomEditorInfoCollection } from '../common/customEditor.js';
import { CustomEditorModelManager } from '../common/customEditorModelManager.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ContributedCustomEditors } from '../common/contributedCustomEditors.js';
import { CustomEditorInput } from './customEditorInput.js';
let CustomEditorService = class CustomEditorService extends Disposable {
    constructor(fileService, storageService, editorService, editorGroupService, instantiationService, uriIdentityService, editorResolverService) {
        super();
        this.editorService = editorService;
        this.editorGroupService = editorGroupService;
        this.instantiationService = instantiationService;
        this.uriIdentityService = uriIdentityService;
        this.editorResolverService = editorResolverService;
        this._untitledCounter = 0;
        this._editorResolverDisposables = this._register(new DisposableStore());
        this._editorCapabilities = new Map();
        this._onDidChangeEditorTypes = this._register(new Emitter());
        this.onDidChangeEditorTypes = this._onDidChangeEditorTypes.event;
        this._fileEditorFactory = Registry.as(EditorExtensions.EditorFactory).getFileEditorFactory();
        this._models = new CustomEditorModelManager();
        this._contributedEditors = this._register(new ContributedCustomEditors(storageService));
        // Register the contribution points only emitting one change from the resolver
        this.editorResolverService.bufferChangeEvents(this.registerContributionPoints.bind(this));
        this._register(this._contributedEditors.onChange(() => {
            // Register the contribution points only emitting one change from the resolver
            this.editorResolverService.bufferChangeEvents(this.registerContributionPoints.bind(this));
            this._onDidChangeEditorTypes.fire();
        }));
        // Register group context key providers.
        // These set the context keys for each editor group and the global context
        const activeCustomEditorContextKeyProvider = {
            contextKey: CONTEXT_ACTIVE_CUSTOM_EDITOR_ID,
            getGroupContextKeyValue: group => this.getActiveCustomEditorId(group),
            onDidChange: this.onDidChangeEditorTypes
        };
        const customEditorIsEditableContextKeyProvider = {
            contextKey: CONTEXT_FOCUSED_CUSTOM_EDITOR_IS_EDITABLE,
            getGroupContextKeyValue: group => this.getCustomEditorIsEditable(group),
            onDidChange: this.onDidChangeEditorTypes
        };
        this._register(this.editorGroupService.registerContextKeyProvider(activeCustomEditorContextKeyProvider));
        this._register(this.editorGroupService.registerContextKeyProvider(customEditorIsEditableContextKeyProvider));
        this._register(fileService.onDidRunOperation(e => {
            if (e.isOperation(2 /* FileOperation.MOVE */)) {
                this.handleMovedFileInOpenedFileEditors(e.resource, this.uriIdentityService.asCanonicalUri(e.target.resource));
            }
        }));
        const PRIORITY = 105;
        this._register(UndoCommand.addImplementation(PRIORITY, 'custom-editor', () => {
            return this.withActiveCustomEditor(editor => editor.undo());
        }));
        this._register(RedoCommand.addImplementation(PRIORITY, 'custom-editor', () => {
            return this.withActiveCustomEditor(editor => editor.redo());
        }));
    }
    getEditorTypes() {
        return [...this._contributedEditors];
    }
    withActiveCustomEditor(f) {
        const activeEditor = this.editorService.activeEditor;
        if (activeEditor instanceof CustomEditorInput) {
            const result = f(activeEditor);
            if (result) {
                return result;
            }
            return true;
        }
        return false;
    }
    registerContributionPoints() {
        // Clear all previous contributions we know
        this._editorResolverDisposables.clear();
        for (const contributedEditor of this._contributedEditors) {
            for (const globPattern of contributedEditor.selector) {
                if (!globPattern.filenamePattern) {
                    continue;
                }
                this._editorResolverDisposables.add(this.editorResolverService.registerEditor(globPattern.filenamePattern, {
                    id: contributedEditor.id,
                    label: contributedEditor.displayName,
                    detail: contributedEditor.providerDisplayName,
                    priority: contributedEditor.priority,
                }, {
                    singlePerResource: () => !(this.getCustomEditorCapabilities(contributedEditor.id)?.supportsMultipleEditorsPerDocument ?? false)
                }, {
                    createEditorInput: ({ resource }, group) => {
                        return { editor: CustomEditorInput.create(this.instantiationService, { resource, viewType: contributedEditor.id, webviewTitle: undefined, iconPath: undefined }, group.id) };
                    },
                    createUntitledEditorInput: ({ resource }, group) => {
                        return { editor: CustomEditorInput.create(this.instantiationService, { resource: resource ?? URI.from({ scheme: Schemas.untitled, authority: `Untitled-${this._untitledCounter++}` }), viewType: contributedEditor.id, webviewTitle: undefined, iconPath: undefined }, group.id) };
                    },
                    createDiffEditorInput: (diffEditorInput, group) => {
                        return { editor: this.createDiffEditorInput(diffEditorInput, contributedEditor.id, group) };
                    },
                }));
            }
        }
    }
    createDiffEditorInput(editor, editorID, group) {
        const modifiedOverride = CustomEditorInput.create(this.instantiationService, { resource: assertReturnsDefined(editor.modified.resource), viewType: editorID, webviewTitle: undefined, iconPath: undefined }, group.id, { customClasses: 'modified' });
        const originalOverride = CustomEditorInput.create(this.instantiationService, { resource: assertReturnsDefined(editor.original.resource), viewType: editorID, webviewTitle: undefined, iconPath: undefined }, group.id, { customClasses: 'original' });
        return this.instantiationService.createInstance(DiffEditorInput, editor.label, editor.description, originalOverride, modifiedOverride, true);
    }
    get models() { return this._models; }
    getCustomEditor(viewType) {
        return this._contributedEditors.get(viewType);
    }
    getContributedCustomEditors(resource) {
        return new CustomEditorInfoCollection(this._contributedEditors.getContributedEditors(resource));
    }
    getUserConfiguredCustomEditors(resource) {
        const resourceAssocations = this.editorResolverService.getAssociationsForResource(resource);
        return new CustomEditorInfoCollection(coalesce(resourceAssocations
            .map(association => this._contributedEditors.get(association.viewType))));
    }
    getAllCustomEditors(resource) {
        return new CustomEditorInfoCollection([
            ...this.getUserConfiguredCustomEditors(resource).allEditors,
            ...this.getContributedCustomEditors(resource).allEditors,
        ]);
    }
    registerCustomEditorCapabilities(viewType, options) {
        if (this._editorCapabilities.has(viewType)) {
            throw new Error(`Capabilities for ${viewType} already set`);
        }
        this._editorCapabilities.set(viewType, options);
        return toDisposable(() => {
            this._editorCapabilities.delete(viewType);
        });
    }
    getCustomEditorCapabilities(viewType) {
        return this._editorCapabilities.get(viewType);
    }
    getActiveCustomEditorId(group) {
        const activeEditorPane = group.activeEditorPane;
        const resource = activeEditorPane?.input?.resource;
        if (!resource) {
            return '';
        }
        return activeEditorPane?.input instanceof CustomEditorInput ? activeEditorPane.input.viewType : '';
    }
    getCustomEditorIsEditable(group) {
        const activeEditorPane = group.activeEditorPane;
        const resource = activeEditorPane?.input?.resource;
        if (!resource) {
            return false;
        }
        return activeEditorPane?.input instanceof CustomEditorInput;
    }
    async handleMovedFileInOpenedFileEditors(oldResource, newResource) {
        if (extname(oldResource).toLowerCase() === extname(newResource).toLowerCase()) {
            return;
        }
        const possibleEditors = this.getAllCustomEditors(newResource);
        // See if we have any non-optional custom editor for this resource
        if (!possibleEditors.allEditors.some(editor => editor.priority !== RegisteredEditorPriority.option)) {
            return;
        }
        // If so, check all editors to see if there are any file editors open for the new resource
        const editorsToReplace = new Map();
        for (const group of this.editorGroupService.groups) {
            for (const editor of group.editors) {
                if (this._fileEditorFactory.isFileEditor(editor)
                    && !(editor instanceof CustomEditorInput)
                    && isEqual(editor.resource, newResource)) {
                    let entry = editorsToReplace.get(group.id);
                    if (!entry) {
                        entry = [];
                        editorsToReplace.set(group.id, entry);
                    }
                    entry.push(editor);
                }
            }
        }
        if (!editorsToReplace.size) {
            return;
        }
        for (const [group, entries] of editorsToReplace) {
            this.editorService.replaceEditors(entries.map(editor => {
                let replacement;
                if (possibleEditors.defaultEditor) {
                    const viewType = possibleEditors.defaultEditor.id;
                    replacement = CustomEditorInput.create(this.instantiationService, { resource: newResource, viewType, webviewTitle: undefined, iconPath: undefined }, group);
                }
                else {
                    replacement = { resource: newResource, options: { override: DEFAULT_EDITOR_ASSOCIATION.id } };
                }
                return {
                    editor,
                    replacement,
                    options: {
                        preserveFocus: true,
                    }
                };
            }), group);
        }
    }
};
CustomEditorService = __decorate([
    __param(0, IFileService),
    __param(1, IStorageService),
    __param(2, IEditorService),
    __param(3, IEditorGroupsService),
    __param(4, IInstantiationService),
    __param(5, IUriIdentityService),
    __param(6, IEditorResolverService)
], CustomEditorService);
export { CustomEditorService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3VzdG9tRWRpdG9ycy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jdXN0b21FZGl0b3IvYnJvd3Nlci9jdXN0b21FZGl0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUUxRixPQUFPLEVBQWlCLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDakYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDN0YsT0FBTyxFQUFFLDBCQUEwQixFQUFFLGdCQUFnQixFQUFxRSxNQUFNLDJCQUEyQixDQUFDO0FBQzVKLE9B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